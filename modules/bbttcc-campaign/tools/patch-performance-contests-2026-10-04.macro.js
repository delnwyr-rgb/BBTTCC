/* patch-performance-contests-2026-10-04.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * PERFORMANCE CONTESTS (Dave, 2026-10-04: "build it with the Cadence and skate-off!"). The Courtly engine now runs in a style's clothes
 * (bbttcc-raid data/performance-profiles.json: fuel pools, move names, the crowd, the foul); a beat opens one with
 * worldEffects.performance and the contest's ending plays the story's own ending beat. Wires the first two:
 *   THE CADENCE — cadence_battle gains "Dance it out." → NEW cadence_floor_contest (profile dance, challenger The Cadence):
 *     party wins clean → cadence_win_style · loses / draws → cadence_lose · anyone draws steel → cadence_win_ugly.
 *   THE TANNERITOS — enc_forgotten_yesterdays_skate gains "Skate it off." → NEW enc_forgotten_yesterdays_skate_contest (profile skate,
 *     challenger Tanneritos): wins clean → _skate_success · loses / draws → _skate_mixed · anyone goes mall cop → _skate_failure.
 *   The old hand-picked outcomes stay as the GM's fallback, relabelled "(GM call) …" so nobody picks their own result by accident.
 * Needs: bbttcc-raid raid-courtly.influence.enhancer.js + data/performance-profiles.json and bbttcc-campaign world-mutation-engine.js
 * of 2026-10-04 (F5 after deploy). Idempotent; one backup. In run-golden-13 after the Legansus hearing.
 * HOW TO RUN: 1) hard-reload; 2) run (DRY_RUN = true) → console (F12); 3) DRY_RUN = false, run again; 4) F5.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id} (its seeder never ran here?)`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id} (already)`); };
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const CONTESTS = [
    { parent: "cadence_battle", id: "cadence_floor_contest", label: "The Cadence — Dance It Out",
      choice: ch("Dance it out.", "cadence_floor_contest", { description: "The floor decides. Nobody draws steel." }),
      text: "Four bars of count, loud enough to feel in your teeth, and the floor is open. The Maestra takes the first figure herself, which her crew will tell you she only does when she thinks the other side might be worth it. Find the pocket. Stay in it. Whatever happens, nobody draws steel.",
      performance: { profile: "dance", challengerName: "The Cadence", defenderName: null, routes: { triumph: "cadence_win_style", grace: "cadence_lose", ugly: "cadence_win_ugly" } },
      relabel: /^(Out-dance them|Win ugly|Lose gracefully)/ },
    { parent: "enc_forgotten_yesterdays_skate", id: "enc_forgotten_yesterdays_skate_contest", label: "The Skate-Off",
      choice: ch("Skate it off.", "enc_forgotten_yesterdays_skate_contest", { description: "The rail decides. Do not be a mall cop about it." }),
      text: "Somebody kills the food-court music and somebody else puts on a tape that has clearly been taped over many times. The Tanneritos line the rail. The run is drawn on a napkin and passed around like a treaty. Land it, go big, or eat pavement interestingly. The only way to lose forever is to act like a mall cop.",
      performance: { profile: "skate", challengerName: "Tanneritos", defenderName: null, routes: { triumph: "enc_forgotten_yesterdays_skate_success", grace: "enc_forgotten_yesterdays_skate_mixed", ugly: "enc_forgotten_yesterdays_skate_failure" } },
      relabel: null }
  ];

  for (const C of CONTESTS) {
    const parent = byId.get(C.parent);
    if (!parent) { say(`✗ MISSING ${C.parent} — ${C.label} not wired`); continue; }
    if (!byId.get(C.id)) {
      const b = foundry.utils.deepClone(parent);
      Object.assign(b, { id: C.id, label: C.label, description: C.text, type: "narration", choices: [], tags: `${parent.tags || ""},performance-contest`.replace(/^,/, ""), hexName: null, targetHexUuid: null });
      b.worldEffects = { performance: { ...C.performance, ...(C.performance.defenderName ? {} : { defenderName: undefined }) } };
      delete b.worldEffects.performance.defenderName;
      b.inject = { ...(parent.inject || {}), repeatable: true, oncePerHex: false };
      delete b.story; delete b.memoryText; delete b.questStep; if (b.cinematic) b.cinematic = { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null };
      camp.beats.push(b); byId.set(b.id, b); changes++; say(`✚ beat ${C.id} (${C.performance.profile} contest vs ${C.performance.challengerName} → ${Object.values(C.performance.routes).join(" / ")})`);
    } else say(`· ok beat (already) ${C.id}`);
    edit(C.parent, b => {
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      if (!b.choices.some(c => c.next === C.id)) b.choices.unshift(foundry.utils.deepClone(C.choice));
      if (C.relabel) for (const c of b.choices) if (C.relabel.test(String(c.label || "")) && !/^\(GM call\)/.test(c.label)) c.label = `(GM call) ${c.label}`;
    }, `"${C.choice.label}" opens the contest${C.relabel ? "; hand-picked results relabelled (GM call)" : ""}`);
  }

  console.group(`[patch-performance-contests-2026-10-04] ${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s)`); report.forEach(r => console.log(" •", r)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Performance contests DRY RUN: ${changes} change(s) — console (F12). Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Performance contests: nothing to change.");
  (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-performance-contests-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Performance contests applied: ${changes} change(s). F5.`);
})();
