/*
 * RUN ORDER (fix round 2026-11-08 — run the teeth macros in this order, each dry first):
 *   1 teeth-phaseA-range-area-forms   (stamps legacy Forms — later macros read the stamp)
 *   2 teeth-phaseA-frame-fields       3 teeth-phaseA-legacy-intent     4 teeth-phaseA-damage-tracks
 *   5 teeth-phaseA-resolution         6 teeth-phaseA-conditions
 *   7 teeth-phaseA-cost-activation    (clears costType, which the Form test reads — it stamps first itself too)
 *   8 teeth-phaseA-signatures-labels  9 rescore-rubric-v1-2 (LAST — the only one meant to move tiers; 1–8 pin them)
 *
 * rescore-rubric-v1-2-2026-11-08.macro.js — Manifestation Engine teeth, Phase B (C9): re-score every manifestation on the
 * Rubric v1.2 points budget (Dave 2026-11-08: "a system of weights and costs").
 *
 * The scorer is the system's own (game.fourththing.manifestation.magnitude — the same code the Engine Review, the sheet
 * re-score hook and the item sheets' "⚖" line use): damage 2 pts per 1d6 average, Clarity / Noise 1 per point, range and
 * area 0 / 1 / 2 past 30 ft / 120 ft, conditions 1 minor · 2 major (half when the target gets a save, +1 scene-long, −1 save
 * each round, +1 when they land on a hit with no save), +1 harm with no roll at all, wards ceil(points/2) + 1 per resist +
 * 2 per immune, chain (floor T2), conditional damage at half, +1 Bonus / Reaction, a foe's fixed DC, −2 Signature, an
 * extra Stress / Noise / Strain cost buys back (Stress at half, at most 3). Net 0–3 T1 · 4–5 T2 · 6–7 T3 · 8+ T4; hex-wide = T4.
 *
 * Scope: world items, every actor's items, unlinked token deltas. Powers with a manifestation block and Form weapons
 * (game.fourththing.isFormWeapon, no stamping). Compendium packs are NOT touched.
 *
 *   DRY RUN by default — report only.
 *   globalThis.__rescoreV12Write = true      → writes system.manifestation.tier = the new score on Steward-owned and
 *                                              unowned (world) items whose stored tier differs.
 *   globalThis.__rescoreV12WriteFoes = true  → also writes foe-owned items (off by default: foe items keep their authored
 *                                              tiers, the same rule as the sheet re-score hook — threat chassis scales them).
 *
 * Report sections:
 *   steward / world / foe  — "stored Tn → new Tm (net N): +2 damage 1d6 (avg 3.5); +1 …" for every item whose tier moves
 *   unchanged              — counts only
 *   inert                  — Steward items whose NEW tier is above the wielder's tier: a Form goes inert in their hands
 *                            ("inert until Tn"), a Working needs a reach to cast. Fix by hand (ease the build or the GM
 *                            decides) — the macro writes the score regardless when __rescoreV12Write is on.
 *   sigOverCap             — Signatures whose new tier is above their steward's tier (the Engine would refuse the save)
 *   dist                   — stored vs new distribution, Steward vs foe vs world
 * Idempotent.
 */
(async () => {
  const WRITE = globalThis.__rescoreV12Write === true;
  const WRITE_FOES = WRITE && globalThis.__rescoreV12WriteFoes === true;
  const M = game.fourththing?.manifestation;
  if (!M?.magnitude) throw new Error("game.fourththing.manifestation.magnitude missing — deploy the Phase B system + restart first");
  const isFoe = game.fourththing?.isFoeActor ?? ((a) => a?.type === "npc");
  const isForm = (it) => { try { return game.fourththing?.isFormWeapon?.(it, { stamp: false }) === true; } catch (_e) { return false; } };
  const line = M.magnitudeLine ?? ((r) => `${r.points > 0 ? "+" : ""}${r.points} ${r.note}`);
  const stewardTier = (a) => {
    const lvl = Number(a?.system?.details?.level ?? 1) || 1;
    return lvl >= 16 ? 4 : lvl >= 11 ? 3 : lvl >= 6 ? 2 : 1;
  };
  const blankDist = () => ({ stored: { 1: 0, 2: 0, 3: 0, 4: 0 }, now: { 1: 0, 2: 0, 3: 0, 4: 0 }, n: 0, up: 0, down: 0 });
  const report = { WRITE, WRITE_FOES, world: game.world?.id, steward: [], world_items: [], foe: [], inert: [], sigOverCap: [],
    dist: { steward: blankDist(), foe: blankDist(), world: blankDist() }, written: 0, errors: [], scanned: 0 };
  const seen = new Set();

  async function checkItem(it, where, owner) {
    if (seen.has(it.uuid)) return;
    seen.add(it.uuid);
    if (it.type !== "power" && it.type !== "weapon") return;
    if (!it.system?.manifestation || typeof it.system.manifestation !== "object") return;
    if (it.type === "weapon" && !isForm(it)) return;
    report.scanned++;
    const kind = it.type === "weapon" ? "weapon" : "power";
    let m;
    try { m = M.magnitude(it, kind, owner ?? null); }
    catch (e) { report.errors.push(`${where}: ${it.name}: ${e.message}`); return; }
    const stored = Math.max(1, Math.min(4, Number(it._source?.system?.manifestation?.tier ?? it.system?.manifestation?.tier) || 1));
    const side = !owner ? "world" : (isFoe(owner) ? "foe" : "steward");
    const d = report.dist[side];
    d.n++; d.stored[stored]++; d.now[m.tier]++;
    if (m.tier > stored) d.up++; else if (m.tier < stored) d.down++;
    const label = `${where}: ${it.name} [${kind === "weapon" ? "Form" : "power"}] (${it.uuid})`;
    const why = m.breakdown.map(line).join("; ") || "nothing scores";
    if (side === "steward") {
      const cap = stewardTier(owner);
      if (m.tier > cap) report.inert.push(`${label} — scores T${m.tier}, wielder is T${cap} (${kind === "weapon" ? "Form goes inert" : "Working needs a reach"}): ${why}`);
      if (it.system.manifestation.isSignature === true && m.tier > cap) report.sigOverCap.push(`${label} — Signature scores T${m.tier} over the T${cap} cap`);
    }
    if (m.tier === stored) return;
    const row = `${label} — stored T${stored} → T${m.tier} (net ${m.net}): ${why}`;
    (side === "steward" ? report.steward : side === "foe" ? report.foe : report.world_items).push(row);
    const mayWrite = WRITE && (side !== "foe" || WRITE_FOES);
    if (!mayWrite) return;
    try { await it.update({ "system.manifestation.tier": m.tier }); report.written++; }   // explicit tier: the re-score hook stands aside
    catch (e) { report.errors.push(`${label}: ${e.message}`); }
  }

  for (const it of game.items.contents) await checkItem(it, "world", null);
  for (const a of game.actors.contents) for (const it of a.items.contents) await checkItem(it, a.name, a);
  for (const sc of game.scenes.contents) {
    for (const tok of sc.tokens.contents) {
      if (tok.actorLink || !tok.actor) continue;
      for (const it of tok.actor.items.contents) {
        if (!tok.delta?.items?.get?.(it.id)) continue;   // base items were scanned on the world actor
        await checkItem(it, `${sc.name} / ${tok.name}`, tok.actor);
      }
    }
  }

  const fmt = (d) => `T1 ${d[1]} · T2 ${d[2]} · T3 ${d[3]} · T4 ${d[4]}`;
  const distLine = (k) => { const d = report.dist[k]; return `${k} ${d.n}: stored ${fmt(d.stored)} → v1.2 ${fmt(d.now)} (up ${d.up}, down ${d.down})`; };
  const summary = `Rubric v1.2 re-score — ${WRITE ? `WRITTEN ${report.written}` : "DRY RUN"}: ${distLine("steward")} | ${distLine("foe")} | ${distLine("world")}`
    + ` | inert ${report.inert.length}, Signatures over cap ${report.sigOverCap.length}; scanned ${report.scanned}; errors ${report.errors.length}`;
  console.log(summary, report);
  ui.notifications?.info(summary);
  return report;
})();
