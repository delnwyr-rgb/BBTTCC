/* audit-monodynamic-exposure.macro.js — where is the big bad NAMED, and who can see it?
 * 2026-08-19. READ-ONLY. GM only.
 *
 * 🔒 Canon: Monodynamic Industries / Mr. Monocle is the NEXT campaign's big bad.
 * Never named to players at this stage — receipts only. Owner ruling
 * 2026-08-19: "MD should be expurgated from anything player facing at this
 * stage, definitely."
 *
 * 🪤 THE FIRST DRAFT OF THIS AUDIT WAS WRONG. It claimed "beats have no
 * ownership — if a beat fires, the player reads it," and would have reported
 * every GM-side beat as a leak. Beat content is GM-only BY DEFAULT. There are
 * four distinct player surfaces and they expose different FIELDS, so the
 * question is never "does the name appear in this beat" but "does it appear in
 * a field that this beat's surface actually publishes":
 *
 *   1. 📢 BROADCAST — `_runBeatDialog` (module.js:2101) checks
 *      isPlayerFacing = playerFacing || playerFacingDialog || dialogPlayerFacing
 *                    || playerFacingContent || showToPlayers
 *      (five aliases — all five are in live use, so test all five). When set,
 *      `_broadcastPlayerFacingDialog` pushes the beat TITLE, DESCRIPTION and
 *      every choice LABEL + DESCRIPTION + check label to the players' screens.
 *
 *   2. 🗣 SPOKEN — a beat with a `speakerActorId`, at least one labelled
 *      choice, and `dialogueOffer !== false` becomes a conversation moment
 *      (`_dialogueOfferableBeats`, :5037). `dialogueChoicesFor` (:5084) is
 *      explicit: "The beat's description is the NPC's authored script for the
 *      scene — the dialogue engine plays it in-voice." So the DESCRIPTION and
 *      the choice labels/descriptions are spoken aloud by the NPC.
 *
 *   3. 🧠 NPC MEMORY — `memoryText` is written to the speaker's
 *      flags.bbttcc-mal-voice.memories (:5364) and colours what that NPC says
 *      later. Slower leak, same destination. Falls back to the beat LABEL plus
 *      the chosen choice label when memoryText is blank — so a label can leak
 *      even with no memoryText authored.
 *
 *   4. 🔒 GM-ONLY — everything else. The GM may still read it aloud, but the
 *      software never publishes it. This is what "receipts only" looks like.
 *
 * ⚠ Surfaces 1–3 are judged STRUCTURALLY. A dialogue beat still has to pass
 * `_beatRequiresMet` at runtime, which can't be evaluated statically, so
 * SPOKEN is "offerable if its gates open", not "will definitely be said".
 * That's the right way to be wrong here: over-report the spoken surface,
 * never under-report it.
 *
 * Documents (journals/items/actors) use real ownership, incl. per-PAGE
 * ownership, since a page can be public inside a private entry.
 */
(async () => {
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // Add aliases here as canon grows. Case-insensitive, word-boundaried.
  const TARGETS = [/\bMonodynamic\b/i, /\bMr\.?\s*Monocle\b/i, /\bMonocle\b/i];
  const hit = (s) => typeof s === "string" && TARGETS.some(re => re.test(s));

  const L = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  const playerIds = game.users.filter(u => !u.isGM).map(u => u.id);
  const isPublic = (doc) => {
    const own = doc?.ownership || {};
    if ((own.default ?? L.NONE) >= L.OBSERVER) return true;
    return playerIds.some(id => (own[id] ?? -1) >= L.OBSERVER);
  };

  // 🪤 Show the text AROUND the match, not the head of the field. The first
  // version printed field.slice(0,160) and the reported hit was often past the
  // cutoff, so the evidence line contained no target name at all — useless for
  // deciding what to expurgate.
  const snip = (s, pad = 105) => {
    const t = String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let i = -1;
    for (const re of TARGETS) { const m = t.match(re); if (m && (i < 0 || m.index < i)) i = m.index; }
    if (i < 0) return t.slice(0, pad * 2);
    const a = Math.max(0, i - pad), b = Math.min(t.length, i + pad);
    return `${a ? "…" : ""}${t.slice(a, b)}${b < t.length ? "…" : ""}`;
  };

  // Second-person prose on a GM-only beat is authored READ-ALOUD: the engine
  // never publishes it, but the GM narrates it at the table. Not a software
  // leak, still a disclosure — the owner has to make that call per line.
  const readsAloud = (s) => /\b(you|your)\b/i.test(String(s).replace(/<[^>]+>/g, " ").slice(0, 400));

  // 🪤 A single `description` often holds BOTH narration and a trailing GM
  // block, by an authoring convention used ~36× across the seeders:
  //   "…the woman may go on waiting.  ⚙ GM: `stasis` persists under management."
  // A name after that marker is a GM note, not something the table hears.
  // Judging the field as one lump mislabels those as read-aloud leaks.
  const GM_MARKER = /⚙\s*GM:|⚙\s*ENGINE NOTE|\bGM ONLY\b/;
  const afterGmMarker = (s) => {
    const t = String(s).replace(/<[^>]+>/g, " ");
    const mk = t.match(GM_MARKER);
    if (!mk) return false;
    let first = -1;
    for (const re of TARGETS) { const m = t.match(re); if (m && (first < 0 || m.index < first)) first = m.index; }
    return first >= 0 && first > mk.index;   // every hit sits inside the GM block
  };

  const broadcast = [], spoken = [], memory = [], gmOnly = [], narrated = [], picks = [], docsPublic = [], docsPrivate = [];

  // ── BEATS ────────────────────────────────────────────────────────────────
  try {
    let raw = game.settings.get(NS, "campaigns");
    const camps = typeof raw === "string" ? JSON.parse(raw) : raw;
    for (const [cid, camp] of Object.entries(camps || {})) {
      for (const b of (camp?.beats || [])) {
        // all five aliases, exactly as the engine tests them
        const isPF = !!(b.playerFacing || b.playerFacingDialog || b.dialogPlayerFacing
                     || b.playerFacingContent || b.showToPlayers);
        const labelled = (b.choices || []).filter(ch => String(ch?.label || "").trim());
        const isDlg = !!String(b.speakerActorId || "").trim()
                   && labelled.length > 0
                   && b.dialogueOffer !== false;
        const speaker = game.actors?.get?.(String(b.speakerActorId || ""))?.name || b.speakerActorId || "?";

        // field -> which surface publishes it
        const fields = [];
        fields.push(["label", b.label, isPF ? "broadcast" : "memory-fallback"]);
        fields.push(["description", b.description, isPF ? "broadcast" : (isDlg ? "spoken" : "gm")]);
        fields.push(["memoryText", b.memoryText, "memory"]);
        (b.choices || []).forEach((ch, i) => {
          const s = isPF ? "broadcast" : (isDlg ? "spoken" : "gm");
          fields.push([`choices[${i}].label`, ch?.label, s]);
          fields.push([`choices[${i}].description`, ch?.description, s]);
        });

        for (const [path, val, surface] of fields) {
          if (!hit(val)) continue;
          const where = `   ${b.id}  .${path}\n        ${snip(val)}`;
          if (surface === "broadcast") broadcast.push(`${where}\n        → BROADCAST to players (playerFacing flag set)`);
          else if (surface === "spoken") spoken.push(`${where}\n        → SPOKEN by ${speaker} if its gates open`);
          else if (surface === "memory") memory.push(`${where}\n        → written into ${speaker}'s memory`);
          else if (surface === "memory-fallback") {
            // label only leaks via memory when memoryText is absent
            (String(b.memoryText || "").trim() ? gmOnly : memory)
              .push(`${where}\n        → ${String(b.memoryText || "").trim() ? "GM-only" : `memory fallback (no memoryText) → ${speaker}`}`);
          }
          // GM-only, but two kinds of GM-only are not equally safe
          else if (/choices\[\d+\]\.label/.test(path)) {
            picks.push(`${where}\n        → this is a CHOICE BUTTON: naming it makes the option itself the reveal`);
          } else if (path === "description" && afterGmMarker(val)) {
            gmOnly.push(`${where}\n        → sits inside the field's ⚙ GM: block — not narration`);
          } else if (path === "description" && readsAloud(val)) {
            narrated.push(`${where}\n        → written in second person; the engine won't publish it, but the GM reads it out`);
          } else gmOnly.push(where);
        }

        // anything else in the beat (gmNotes, worldEffects, etc.) = GM-only
        for (const [k, v] of Object.entries(b)) {
          if (["label", "description", "memoryText", "choices", "id"].includes(k)) continue;
          if (hit(typeof v === "string" ? v : JSON.stringify(v ?? ""))) gmOnly.push(`   ${b.id}  .${k} (GM-side field)`);
        }
      }
    }
  } catch (e) { broadcast.push(`   (!) could not read campaigns setting: ${e.message}`); }

  // ── JOURNALS, per page (pages carry their own ownership) ─────────────────
  for (const j of game.journal.contents) {
    for (const p of j.pages.contents) {
      const txt = `${p.name}\n${String(p.text?.content || "")}`;
      if (!hit(txt)) continue;
      const n = (txt.match(/\bMonodynamic\b|\bMonocle\b/gi) || []).length;
      const own = p.ownership?.default;
      const readable = (own == null || own === -2) ? isPublic(j) : isPublic(p);
      (readable ? docsPublic : docsPrivate).push(`   [journal] ${j.name} → ${p.name} (×${n})`);
    }
  }

  // ── ITEMS + ACTORS ──────────────────────────────────────────────────────
  for (const [kind, coll] of [["item", game.items], ["actor", game.actors]]) {
    for (const d of coll.contents) {
      if (!hit(JSON.stringify(d.toObject()))) continue;
      (isPublic(d) ? docsPublic : docsPrivate).push(`   [${kind}] ${d.name}`);
    }
  }

  // ── SCENES (names show in the nav bar) ──────────────────────────────────
  for (const sc of game.scenes.contents)
    if (hit(sc.name) || hit(sc.navName)) docsPublic.push(`   [scene] ${sc.name}`);

  const out = [];
  const sec = (t, arr, cap = 30) => {
    out.push(`\n${t} (${arr.length})`);
    out.push(...(arr.length ? arr.slice(0, cap) : ["   (none)"]));
    if (arr.length > cap) out.push(`   … +${arr.length - cap} more`);
  };
  out.push(`🔎 targets: Monodynamic · Mr. Monocle · Monocle`);
  sec("📢 BROADCAST — pushed to player screens. EXPURGATE.", broadcast);
  sec("🗣 SPOKEN — an NPC says this in-voice if gates open. EXPURGATE.", spoken);
  sec("🧠 NPC MEMORY — colours what that NPC says later. EXPURGATE.", memory);
  sec("🖱 CHOICE BUTTONS — the option text itself names the target", picks);
  sec("🎙 GM-ONLY BUT WRITTEN AS READ-ALOUD — your call, per line", narrated);
  sec("🔒 GM-ONLY, NOT NARRATED — safe; 'receipts only' working", gmOnly, 15);
  sec("📖 DOCUMENTS PLAYERS CAN OPEN — check these", docsPublic);
  sec("🔒 DOCUMENTS PLAYERS CANNOT OPEN — safe", docsPrivate, 15);

  const leaks = broadcast.length + spoken.length + memory.length;
  console.log("[audit-monodynamic-exposure]\n" + out.join("\n"));
  ui.notifications[leaks || docsPublic.length ? "warn" : "info"](
    `Monodynamic: ${leaks} auto-leak(s) · ${picks.length} choice button(s) · ${narrated.length} read-aloud · ${docsPublic.length} readable doc(s) — see console.`);
})();
