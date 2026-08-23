/* audit-beat-actors.macro.js — who is in this beat, and do they exist yet?
 * 2026-08-19.
 *
 * WHY: across 672 beats, `actors[]` is populated on ONE and `speakerActorId`
 * on 98 — so ~262 of the 310 dialog/skill_scene beats stage a conversation
 * with nobody attached. The scenes read as narration because, structurally,
 * nobody is in them. This turns "we have no NPCs" into three concrete lists.
 *
 * WHAT IT REPORTS
 *  A. ATTACHABLE NOW — the beat names an actor that already exists in the
 *     world. If the name is in the beat's LABEL that's a strong signal the
 *     actor is the speaker, and APPLY will stamp `speakerActorId`.
 *  B. MINT LIST — a person-shaped name recurs in beat text but no actor
 *     exists. This is the "who do I still need to make" list, by frequency.
 *  C. FACELESS — dialog/skill_scene beats whose text names nobody at all.
 *     These need AUTHORING, not attaching; listed thinnest-first because a
 *     short faceless scene is the likeliest to be a stub.
 *
 * Place-names are excluded automatically by building a stoplist from the
 * world's own scene names and hex labels — the world tells us what's a place.
 *
 * APPLY (optional): set APPLY=true to stamp `speakerActorId` for the
 * high-confidence cases only (actor named in the beat LABEL, beat has no
 * speaker yet). Never overwrites. Body-only mentions are reported, never
 * auto-attached — a beat can mention someone who isn't speaking.
 *
 * DRY by default. GM only. Read-only unless APPLY=true.
 */
(async () => {
  const APPLY = false;               // <-- true to stamp high-confidence speakers
  const NS = "bbttcc-campaign", TERR = "bbttcc-territory";
  const MAX_ROWS = 14;               // per-section print cap
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const strip = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // ── places are not people ─────────────────────────────────────────────────
  const PLACES = new Set();
  for (const sc of game.scenes.contents) PLACES.add(sc.name.toLowerCase());
  for (const sc of game.scenes.contents)
    for (const dr of (sc.drawings?.contents || []))
      if (dr.flags?.[TERR]) PLACES.add(String(dr.text || dr.flags[TERR]?.name || "").replace(/\u00a0/g, " ").toLowerCase());
  const STOP = new Set(["The","A","An","You","Your","It","They","We","I","This","That","There","And","But","So","If","When","Then","Not","No","Yes","GM","Mal","OK","Turn","Hex","Spark","Darkness","Restore","Redirect","Break","Leave","Continue","Noted","Finish","Move","Stand","Take","One","Two","Three","Somewhere","Nobody","Everyone","Someone","Vault","Farm","Mall","Creek","Reach","Myre","Coast","Station","Chapel","Garden"]);

  // Longest-first so "Furrier's Fixit Farm" is consumed before "Fixit Farm".
  const PLACE_RE = [...PLACES].filter(p => p && p.length > 3)
    .sort((a, b) => b.length - a.length)
    .map(p => esc(p).replace(/\\?\s+/g, "[\\s\u00a0]+"));
  const maskPlaces = (txt) => {
    let t = String(txt || "");
    for (const p of PLACE_RE) t = t.replace(new RegExp(`${p}(?:['\u2019]s)?`, "gi"), m => " ".repeat(m.length));
    return t;
  };

  // ── the world's PEOPLE (not its factions, rigs or buildings) ──────────────
  // 🪤 The first cut of this audit matched faction actors named for places —
  // "Allesh Gilliam", "Lyrenn", "Khezek Tor" — and reported 35 beats each.
  // Only people can speak, so filter by the canonical kind tag.
  const PERSON_KINDS = new Set(["npc", "steward", "monster"]);
  const kindOf = (a) => { try { return game.bbttcc?.api?.actorKind?.(a) || null; } catch (_) { return null; } };
  const excluded = [];
  const ACTORS = [];
  for (const a of game.actors.contents) {
    const k = kindOf(a);
    const isPerson = k ? PERSON_KINDS.has(k)
      : !/faction|coalition|rig|facility|vehicle|hex/i.test(`${a.type} ${a.name}`);
    if (!isPerson) { excluded.push(`${a.name} [${k || a.type}]`); continue; }
    if (PLACES.has(String(a.name).toLowerCase())) { excluded.push(`${a.name} [name is a place]`); continue; }
    ACTORS.push({ id: a.id, name: a.name, kind: k || a.type });
  }

  // Aliases: a distinctive surname ("Chairperson Laser Bev" -> "Bev").
  // 🪤 Parentheticals produced garbage — "Pip (post maneuver vault)" aliased to
  // "vault" and matched every Maneuver Vault beat. Strip them; never alias to a
  // place-word or a stopword.
  const aliasOf = (name) => {
    const clean = String(name).replace(/\([^)]*\)/g, " ").replace(/[^A-Za-z'\u2019\s-]/g, " ").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;
    const last = parts[parts.length - 1];
    if (last.length < 4) return null;
    if (!/^[A-Z]/.test(last)) return null;
    if (PLACES.has(last.toLowerCase()) || STOP.has(last)) return null;
    return last;
  };

  // ── load beats ────────────────────────────────────────────────────────────
  let raw = game.settings.get(NS, "campaigns");
  const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beats = camp.beats || [];

  const A = new Map();   // actorName -> [{beat, inLabel}]
  const B = new Map();   // candidateName -> {count, sample}
  const C = [];          // faceless dialog beats
  let stamped = 0;

  for (const b of beats) {
    const label0 = String(b.label || "");
    const body0  = strip(b.description);
    // 🪤 "Furrier" lived inside "Furrier's Fixit Farm" and matched 26 beats.
    // Blank out every known place-name FIRST, so a person named like a place
    // can only match where the place isn't.
    const label = maskPlaces(label0);
    const body  = maskPlaces(body0);
    const hay   = `${label}\n${body}`;
    const isTalk = ["dialog", "skill_scene"].includes(String(b.type || ""));
    const hasPerson = !!(b.speakerActorId || (b.actors || []).length);

    // A — does it name a real actor?
    let matched = null, inLabel = false;
    for (const a of ACTORS) {
      // Full name: case-insensitive. Alias/surname: CASE-SENSITIVE — otherwise
      // 🪤 "Brexit the Terrible" → "Terrible" matched the word "terrible", and
      // "The General"/"…Gossip"/"…Shadow" matched ordinary prose.
      const probes = [[a.name, "i"], [aliasOf(a.name), ""]].filter(([n]) => n);
      for (const [n, flags] of probes) {
        const re = new RegExp(`\\b${esc(n)}\\b`, flags);
        if (re.test(hay)) { matched = a; inLabel = re.test(label); break; }
      }
      if (matched) break;
    }
    if (matched) {
      if (!hasPerson) {
        if (!A.has(matched.name)) A.set(matched.name, { actor: matched, rows: [] });
        A.get(matched.name).rows.push({ id: b.id, label, inLabel });
        if (APPLY && inLabel && !b.speakerActorId) { b.speakerActorId = matched.id; stamped++; }
      }
      continue;
    }

    // B — person-shaped names with no actor behind them
    for (const m of body.matchAll(/\b([A-Z][a-z'’-]{2,})(?:\s+([A-Z][a-z'’-]{2,}))?\b/g)) {
      const cand = [m[1], m[2]].filter(Boolean).join(" ");
      // 🪤 Sentence-openers ("She", "Just", "What") and contractions ("It's")
      // flooded this list. A real name is capitalised MID-sentence.
      const before = body.slice(Math.max(0, m.index - 40), m.index);
      if (!/[a-z,;:)"'\u2019]\s+$/.test(before)) continue;
      if (/['\u2019]/.test(m[1])) continue;
      if (STOP.has(m[1]) || PLACES.has(cand.toLowerCase())) continue;
      if (ACTORS.some(a => a.name.toLowerCase() === cand.toLowerCase())) continue;
      const e = B.get(cand) || { count: 0, sample: b.id };
      e.count++; B.set(cand, e);
    }

    // C — a conversation with nobody named in it
    if (isTalk && !hasPerson) C.push({ id: b.id, label, len: body.trim().length });
  }

  // ── report ────────────────────────────────────────────────────────────────
  const out = [];
  const talk = beats.filter(b => ["dialog","skill_scene"].includes(String(b.type||"")));
  const withPerson = talk.filter(b => b.speakerActorId || (b.actors||[]).length).length;
  out.push(`beats ${beats.length} · conversational ${talk.length} · of those, ${withPerson} have a person attached (${Math.round(withPerson/talk.length*100)}%)`);
  out.push(`people considered: ${ACTORS.length}   ·   excluded as not-a-person: ${excluded.length}`);
  if (excluded.length) out.push(`  excluded: ${excluded.slice(0, 12).join(" · ")}${excluded.length > 12 ? ` … +${excluded.length - 12}` : ""}`);

  out.push(`\n═══ A. ATTACHABLE NOW — names an actor that already exists ═══`);
  const aRows = [...A.values()].sort((x, y) => y.rows.length - x.rows.length);
  if (!aRows.length) out.push("  (none)");
  for (const { actor, rows } of aRows.slice(0, MAX_ROWS)) {
    const strong = rows.filter(r => r.inLabel).length;
    out.push(`  ${actor.name}  [${actor.id}]  — ${rows.length} beat(s), ${strong} with the name in the LABEL (high confidence)`);
    for (const r of rows.slice(0, 6)) out.push(`      ${r.inLabel ? "★" : "·"} ${r.id}  ${r.label}`);
    if (rows.length > 6) out.push(`      … +${rows.length - 6} more`);
  }
  if (aRows.length > MAX_ROWS) out.push(`  … +${aRows.length - MAX_ROWS} more actors`);

  out.push(`\n═══ B. MINT LIST — named in text, no actor exists ═══`);
  const bRows = [...B.entries()].filter(([, e]) => e.count >= 2).sort((x, y) => y[1].count - x[1].count);
  if (!bRows.length) out.push("  (none)");
  for (const [name, e] of bRows.slice(0, MAX_ROWS * 2)) out.push(`  ${String(e.count).padStart(3)}×  ${name}   (e.g. ${e.sample})`);
  out.push("  ⚠ eyeball these — the extractor is deliberately loose and will catch the odd place or title.");

  out.push(`\n═══ C. FACELESS — a conversation naming nobody (needs AUTHORING) ═══`);
  C.sort((x, y) => x.len - y.len);
  for (const r of C.slice(0, MAX_ROWS)) out.push(`  ${String(r.len).padStart(4)} chars  ${r.id}  ${r.label}`);
  out.push(`  … ${C.length} total; thinnest first — a short faceless scene is the likeliest stub.`);

  if (APPLY && stamped) {
    try {
      const save = foundry.utils.saveDataToFile ?? saveDataToFile;
      save(wasStr ? raw : JSON.stringify(raw), "text/json", `backup-campaigns-before-actor-audit-${Date.now()}.json`);
    } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
    await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
    out.push(`\n✅ APPLIED — stamped ${stamped} speaker(s) (label-match only).`);
  } else if (APPLY) {
    out.push(`\n· APPLY was on but nothing qualified.`);
  } else {
    out.push(`\n· read-only. Set APPLY=true to stamp the ★ (label-match) cases.`);
  }

  console.log("[audit-beat-actors]\n" + out.join("\n"));
  ui.notifications.info("audit-beat-actors: see console (F12).");
})();
