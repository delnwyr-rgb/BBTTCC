/* patch-check-wins-answer-2026-11-03.macro.js — A PASSED CHECK NO LONGER CLOSES THE MENU (failure pass, Dave 2026-11-03: "Sweep all 49 now").
 * Live-caught at the Crown Mall video store: "Ask what's on the shelves. · Mind DC 12" PASSED → the engine posted the button subtitle
 * to chat as a ✓ card (_postCheckWonText) and ended the chain, so the pass cost the table "Ask for the footage". The same shape sat on
 * 49 choices (grief towns, Lyrenn, the Mall): a check whose success `next` is "" inside a menu that still has somewhere to go — and
 * the subtitle showed the answer on the button before the roll.
 * Same rules as patch-dead-ends-sweep-2 (see project_dead_end_sweep_2026_10_26):
 *   • one answer beat per check choice — `ans_<owner>_<slug>_won` — whose text is the old subtitle; shared by every beat that carries
 *     the same choice (the sweep-2 answer beats copy their parent's menu); routing-only (dialogueOffer:false, no questId/story, the
 *     owner's act gate + evergreen, moment/0); it NEVER routes back into the owner (effects re-apply)
 *   • the answer offers the owner's other choices (copied after this sweep's rewiring, so other checks open their own answers) + its
 *     exits; a menu with no exit gets "Leave."
 *   • the choice keeps its check and its failNext; its subtitle is cleared (no spoiler)
 * Idempotent (rerun = 0). DRY_RUN first. Backup (campaigns) → Data/bbttcc-exports/. GM only.
 */
const CHECK_WINS = (() => {
  const EXIT_RE = /^\W*(leave|back|return|ride|onward|go back|actually|not now|not yet|not today|another time|ready to move on|continue|ok\b|noted|done|withdraw|step back)/i;
  const J = (v) => JSON.stringify(v);
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/).slice(0, 5).join("_");
  const title = (p, label) => `${String(p.label || p.id).replace(/\s+—\s+.*$/, "")} — ${String(label).replace(/^["“]+|["”]+$/g, "").replace(/[.!?]+\s*$/, "").trim()}`;
  const actOf = (b) => { const r = (Array.isArray(b?.inject?.requires) ? b.inject.requires : []).find(x => x && x.flag === "storyPhase" && x.gte != null); return r ? Number(r.gte) : null; };
  const keyOf = (c) => `${c.label}\u0001${c.checkStat}\u0001${String(c.description || "").trim()}`;
  const goesSomewhere = (menu, c) => menu.some(y => y && y !== c && (y.next || y.openTravel) && !EXIT_RE.test(String(y.label || "")));
  function apply(camp) {
    if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
    const byId = new Map(camp.beats.map(b => [b.id, b]));
    const report = []; let changes = 0;
    // 1. find every candidate choice, grouped by identity (label + stat + text)
    const groups = new Map();   // key → { owner, holders: [beat], choice }
    for (const b of camp.beats) for (const c of (b.choices || [])) {
      if (!c || !c.checkStat || c.next || c.openTravel) continue;
      if (!String(c.description || "").trim()) continue;
      if (!goesSomewhere(b.choices, c)) continue;
      const k = keyOf(c); let g = groups.get(k); if (!g) groups.set(k, g = { holders: [], choice: c });
      g.holders.push(b);
    }
    // already-swept choices (rerun) have next = ans_*_won and an empty subtitle — they never re-enter the candidate set.
    // 2. owner = the first holder that is not itself an answer beat
    const made = [];
    for (const [k, g] of groups) {
      const owner = g.holders.find(h => !/^ans_/.test(h.id)) || g.holders[0];
      const id = `ans_${owner.id}_${slug(g.choice.label)}_won`;
      let a = byId.get(id);
      if (!a) {
        a = { id, label: title(owner, g.choice.label), type: ["dialog", "narration", "exploration"].includes(owner.type) ? owner.type : "dialog",
          tags: owner.tags || "", politicalTags: "", speakerActorId: owner.speakerActorId || null, sceneId: owner.sceneId || null,
          hexName: owner.hexName ?? null, targetHexUuid: owner.targetHexUuid ?? null, ...(owner.where ? { where: owner.where } : {}),
          outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" }, worldEffects: {}, refs: {},
          playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
          description: String(g.choice.description).trim(), choices: [],
          dialogueOffer: false, timeScale: "moment", timePoints: 0,
          inject: { repeatable: true, oncePerHex: false, evergreen: true, requires: actOf(owner) != null ? [{ flag: "storyPhase", gte: actOf(owner) }] : [] } };
        camp.beats.splice(camp.beats.indexOf(owner) + 1, 0, a); byId.set(id, a); changes++; report.push(`✚ ${id}`);
      }
      for (const h of g.holders) for (const c of (h.choices || [])) if (keyOf(c) === k) { c.next = id; c.description = ""; changes++; }
      made.push({ owner, id, label: g.choice.label });
    }
    // 3. the answers' menus — the owner's other choices as they stand now (never the owner itself, never this choice)
    for (const { owner, id, label } of made) {
      const a = byId.get(id);
      let want = (owner.choices || []).filter(x => x && x.label !== label && x.next !== owner.id).map(x => JSON.parse(J(x)));
      if (!want.some(x => EXIT_RE.test(String(x.label || "")))) want.push({ label: "Leave.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" });
      if (J(a.choices) !== J(want)) { a.choices = want; changes++; report.push(`  ${id}: ${want.map(x => String(x.label).slice(0, 20)).join(" | ")}`); }
    }
    return { changes, report, made: made.length };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = CHECK_WINS;
} else (async () => {
  const DRY_RUN = (globalThis.__checkWinsDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, made } = CHECK_WINS.apply(camp);
  console.log(`[check wins answer 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s), ${made} check(s) answered\n` + report.join("\n"));
  globalThis.__checkWins = { dry: DRY_RUN, changes, made, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-check-wins-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — ${made} passed checks now answer (${changes}).`);
})();
