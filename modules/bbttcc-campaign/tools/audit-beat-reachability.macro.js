/* audit-beat-reachability.macro.js — which beats can actually FIRE?
 * 2026-08-19. Read-only. GM only.
 *
 * WHY: "thin beat" is the wrong question. A hub is meant to be thin; a dead
 * stub is not; and a rich beat nothing can reach is a different problem again.
 * The Circuit Riders proved it — five empty `circuit_riders_parley_*` beats
 * looked like an authoring emergency and were actually dead scaffolding beside
 * a 58-beat chain that was already excellent. Writing them would have produced
 * exactly the duplication the Crown Mall pass complained about.
 *
 * 🪤 A FIRST ATTEMPT AT THIS WAS WRONG. It flagged 63 travel encounters as
 * orphans because they are fired by the TRAVEL TABLES, not by choice routing —
 * and it missed the five genuinely dead beats. Every source below exists
 * because leaving it out produced a confidently wrong answer.
 *
 * REACHABILITY SOURCES (all of them):
 *   1. choice.next on any beat
 *   2. a beat's top-level `next`
 *   3. chase follow-ups (onCaught / onEscaped, incl. nested followUp)
 *   4. TRAVEL TABLE entries — settings "tables", entries[].beatId
 *   5. hex on-enter — flags.bbttcc-territory.campaign.onEnterBeatId on the
 *      scene Drawings (LIVE ONLY; absent from campaign exports, which is why
 *      this must run in-world rather than over a JSON dump)
 *   6. any other data reference — a catch-all string scan of the whole
 *      campaign, so seeder-specific wiring can't hide from us
 *   7. ENGINE-HELD ids — hardcoded in bbttcc-campaign/scripts/module.js and
 *      therefore invisible to any data scan. Listed explicitly below; add to
 *      this when you add an engine hook.
 *   8. director-eligible — carries a storyChain, a questRole, or inject.requires
 *
 * OUTPUT — three lists that mean different things:
 *   🪦 DEAD      unreachable AND empty AND no choices  → safe to archive
 *   🟠 STRANDED  unreachable but WRITTEN               → someone wrote it and
 *                nothing points at it; rewire or retire, never silently delete
 *   ✍ BACKLOG   reachable, conversational, and thin    → the real writing job
 */
(async () => {
  const NS = "bbttcc-campaign", TERR = "bbttcc-territory";
  const THIN = 120;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // Ids the ENGINE holds as string constants — no data reference exists.
  const ENGINE_IDS = new Set([
    // wendigo rung (WENDIGO_TRAVEL_BEAT_IDS)
    "acid_bog_logistics_success", "acid_bog_logistics_failure",
    "enc_broken_bridge_go_around_success", "enc_broken_bridge_go_around_fail",
    // forgotten-cause feud
    "wendigo_confluence_repair", "wendigo_confluence_redirect", "wendigo_confluence_break",
    "gullywasher_cultural_summit_success", "gullywasher_cultural_summit_failure",
    // bandit accord
    "bandit_accord_opening", "bandit_ambush_arms_down",
    "bandit_arms_down_accept", "bandit_arms_down_violence", "bandit_summit_humiliation",
    // geburah conduct ledger (2026-08-18)
    "spark_geburah_northreach_b_worthy", "spark_geburah_mountains_q_worthy", "spark_geburah_mountains_o_worthy",
    "spark_geburah_northreach_b_force", "spark_geburah_mountains_q_force", "spark_geburah_mountains_o_force"
  ]);

  const strip = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").trim();

  let raw = game.settings.get(NS, "campaigns");
  const camps = typeof raw === "string" ? JSON.parse(raw) : raw;
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beats = camp.beats || [];
  const ids = new Set(beats.map(b => b.id));

  // ── collect every reference ───────────────────────────────────────────────
  const why = new Map();                       // beatId -> Set(reasons)
  const mark = (id, reason) => {
    if (!id || !ids.has(id)) return;
    if (!why.has(id)) why.set(id, new Set());
    why.get(id).add(reason);
  };

  for (const b of beats) {
    for (const c of (b.choices || [])) mark(c.next, "choice");
    mark(b.next, "next");
    const ch = b.chase || b.followUp || {};
    mark(ch.onCaught, "chase"); mark(ch.onEscaped, "chase");
    mark(b.onCaught, "chase");  mark(b.onEscaped, "chase");
  }

  // travel tables — the source the first attempt missed entirely
  try {
    // 🪤 The setting key is "encounterTables", not "tables" — the EXPORT calls
    // it `tables`, which is what the first version guessed. It silently found
    // nothing, so every travel encounter looked stranded.
    let tRaw = game.settings.get(NS, "encounterTables");
    const tables = typeof tRaw === "string" ? JSON.parse(tRaw) : tRaw;
    for (const t of Object.values(tables || {}))
      for (const e of (t?.entries || t?.rows || [])) mark(e?.beatId, "travel-table");
  } catch (_) { /* no tables setting */ }

  // hex on-enter — live world only
  let hexHits = 0;
  for (const sc of game.scenes.contents)
    for (const dr of (sc.drawings?.contents || [])) {
      const oe = dr.flags?.[TERR]?.campaign?.onEnterBeatId;
      if (oe) { mark(oe, "hex-onEnter"); hexHits++; }
    }

  // catch-all: any id appearing anywhere in the campaign other than its own `id`
  const blob = JSON.stringify(camp);
  for (const id of ids) {
    const n = blob.split(`"${id}"`).length - 1;
    if (n > 1) mark(id, "data-ref");
  }

  for (const id of ENGINE_IDS) mark(id, "engine");

  // 🪤 An EMPTY `requires` ({} or []) is truthy in JS, so the first cut counted
  // ungated beats as director-offered — which is precisely how the five dead
  // circuit_riders_parley_* stubs disguised themselves as a writing backlog.
  // A gate only counts if it actually constrains something.
  // 🪤 TWO WRONG GUESSES LIVE HERE. First `requires` was tested for truthiness
  // (an empty object is truthy). Then it was tested for non-emptiness — and
  // still 569 of 677 beats came back "gated", because the Phase Charter puts
  // `[{flag:"storyPhase", gte:N}]` on 488 beats. A phase gate says WHEN a beat
  // may be offered, not WHETHER anything can reach it. Treat it as timing.
  const conds = (b) => {
    const r = (b.inject || {}).requires;
    if (!r) return [];
    return Array.isArray(r) ? r : [r];
  };
  const isPhaseOnly = (b) => {
    const c = conds(b);
    return c.length > 0 && c.every(x => String(x?.flag || "") === "storyPhase");
  };
  for (const b of beats) {
    if (b.questRole) mark(b.id, "questRole");
    const c = conds(b);
    if (c.length && !isPhaseOnly(b)) mark(b.id, "gated-director");
    else if (c.length) mark(b.id, "phase-only(timing)");
    if (b.storyChain) mark(b.id, "storyChain(weak)");
  }

  // ── classify ──────────────────────────────────────────────────────────────
  const dead = [], stranded = [], blank = [], backlog = [];
  const ROUTED = new Set(["choice", "next", "chase", "travel-table", "hex-onEnter", "engine", "data-ref"]);
  for (const b of beats) {
    const reasons = why.get(b.id) || new Set();
    const reachable = reasons.size > 0;
    const routed = [...reasons].some(r => ROUTED.has(r));
    const body = strip(b.description);
    const talky = ["dialog", "skill_scene", "encounter"].includes(String(b.type || ""));
    const hasChoices = (b.choices || []).some(c => c.next);
    const w = [...reasons].join(",");
    if (!reachable) {
      (body.length === 0 && !hasChoices ? dead : stranded).push({ b, len: body.length });
    } else if (body.length === 0 && !hasChoices) {
      // Offerable, and there is NOTHING THERE. A player can be served a blank.
      blank.push({ b, len: 0, why: w, routed });
    } else if (talky && body.length <= THIN) {
      backlog.push({ b, len: body.length, why: w });
    }
  }

  const out = [];
  out.push(`beats ${beats.length} · reachable ${why.size} (${Math.round(why.size / beats.length * 100)}%) · hex on-enter links seen ${hexHits}`);
  const src = {};
  for (const s of why.values()) for (const r of s) src[r] = (src[r] || 0) + 1;
  out.push("reachability by source: " + Object.entries(src).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "));

  out.push(`\n🪦 DEAD — unreachable, empty, no choices (${dead.length}) — safe to archive`);
  for (const { b } of dead) out.push(`   ${b.id}   ${b.label || ""}`);
  if (!dead.length) out.push("   (none)");

  out.push(`\n🟠 STRANDED — unreachable but WRITTEN (${stranded.length}) — rewire or retire, don't delete blind`);
  stranded.sort((a, b) => b.len - a.len);
  for (const { b, len } of stranded.slice(0, 20)) out.push(`   ${String(len).padStart(4)}  ${b.id}   ${b.label || ""}`);
  if (stranded.length > 20) out.push(`   … +${stranded.length - 20} more`);

  out.push(`\n👻 BLANK — offerable and EMPTY (${blank.length}) — a player can be served nothing. Fix or remove.`);
  for (const { b, why: w, routed } of blank) out.push(`   ${routed ? "ROUTED " : "offered"}  ${b.id}   ${b.label || ""}   [${w}]`);
  if (!blank.length) out.push("   (none)");

  out.push(`\n✍ BACKLOG — reachable, conversational, ≤${THIN} chars (${backlog.length}) — the real writing job`);
  backlog.sort((a, b) => a.len - b.len);
  for (const { b, len, why: w } of backlog.slice(0, 25)) out.push(`   ${String(len).padStart(4)}  ${b.id}   ${b.label || ""}   [${w}]`);
  if (backlog.length > 25) out.push(`   … +${backlog.length - 25} more`);

  console.log("[audit-beat-reachability]\n" + out.join("\n"));
  ui.notifications.info(`reachability: ${dead.length} dead · ${stranded.length} stranded · ${blank.length} BLANK · ${backlog.length} backlog — see console.`);
})();
