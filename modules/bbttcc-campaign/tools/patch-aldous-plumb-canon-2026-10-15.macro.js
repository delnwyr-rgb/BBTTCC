/* patch-aldous-plumb-canon-2026-10-15.macro.js — RE-AIM THE OLD ALDOUS (companion to patch-aldous-plumb-argument).
 *
 *  The rewrite (Dave, 2026-10-15): Aldous Plumb has NO engineering — he talks to buildings, faked his way into
 *  "Structural Authority (from Canada)", and has not been to the East Wall since a wax-sealed note came under
 *  his door the morning after That One Night. "Cosmetic" was fear, not a lie about a dated survey.
 *  Everything below still played the OLD man (a surveyor hiding a survey three days older than the lean):
 *
 *   ACTORS (bbttcc-mal-voice persona flag, by name):
 *    Aldous Plumb      secrets  The Levee / Three Days Before  →  The Note (stirThePot) / From Canada (rollPlus2);
 *                      notes + topics + courtDoor rewritten (old markers kept so the old seeders stay idempotent)
 *    Marshal Yarrow Pike  secret The Plumb Math → The Canadian (he checked the certificate the week Plumb arrived);
 *                      notes clause (1) rewritten
 *    The East Wall     notes: Plumb "the man who measured once" → "the man who heard me and shut the curtains"
 *   BEATS (campaigns setting, text-guarded):
 *    ag_east_wall_survey / _ok / _miss  — no survey ever existed: the clipboard says COSMETIC, underlined twice, no numbers
 *    ag_east_wall_patched               — "Plumb's clipboard stays nailed to its post, undated" → COSMETIC, underlined twice
 *    allesh_gilliam_town_walk           — door blurb "(self-certified)" → "(from Canada)"
 *    allesh_gilliam_plumb_tower_exterior — "...his back is to it" + ", and lately the curtains are drawn"
 *    allesh_gilliam_wall_stands_straight — "The Architect's office light was on very late" → "...and it was not in the office"
 *   Kept on purpose: "The Architect has an office and an opinion; the wall has a lean and a schedule. One of them is
 *   honest." (east_wall_intro) and Pike's "Architect says it's cosmetic." — both still true of the new man.
 *
 *  Idempotent (label / text guards); DRY_RUN default true; backs up `campaigns` before the write. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", MV = "bbttcc-mal-voice";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0;

  /* ── 1. ACTORS ─────────────────────────────────────────────────────────── */
  const SECRETS = {
    "Aldous Plumb": {
      drop: ["The Levee", "Three Days Before"],
      add: [
        "The Note :: stirThePot :: a Steward asks him, kindly, WHY he has not been to the wall — why, not whether :: The morning after That One Night a folded note came under his door: any attempt to investigate damage to the wall will be met with consequences. Unsigned. Good paper. A WAX seal, in a town that burns tallow. He has read it a hundred times. He is not pompous; he is frightened, and 'cosmetic' is the sound fear makes in a man with a framed certificate. Produced in court, it turns the whole East Wall standoff from incompetence into intimidation — and asks who in Allesh-Gilliam seals anything in wax.",
        "From Canada :: rollPlus2 :: a Steward talks to him about a BUILDING as if it were a person — asks what the Waiting Room wants, or what the granary said :: He has no engineering. None. He talks to buildings. Back in the Harmonized Inner they answered politely, you wrote it down, there was a little lunch, and he faked his way into a title on the strength of it. Here nothing cooperates and the granary called him a word. The one building he could actually help is the one he can't go and ask. Produced in court, it is the end of 'Structural Authority' — and the beginning of the town's only working building-whisperer."
      ],
      notes: "[PLUMB-REWRITE-2026-10-15] PRIVATE TRUTH — Aldous Plumb, Structural Authority (\"from Canada\": a framed certificate with a hand-drawn maple leaf, hung crooked — the wall's fault). VOICE: starts every sentence at full confidence and runs out of it halfway; CAPS when cornered (\"STEADY as a ROCK. Guaranteed by ME.\"); a slightly manic edge; panicked around the eyes. THE TRUTH: he has NO engineering. None. What he has is a gift — he can TALK TO BUILDINGS. In the Harmonized Inner buildings are polite and agreeable: they tell you where they hurt, you write it down, everyone says thank you, Aldous, and there is a little lunch. He faked his way into a title on that gift, came to Bad Eden, and found that here nothing cooperates — things want to fall on you, specifically, out of spite, and then be asked about it; the granary called him a word. His drawings are PORTRAITS: each building drawn the way it would LIKE to be, which is why every one is slightly wrong. None of them is the East Wall. WHY HE WON'T GO TO THE WALL: the morning after That One Night a folded note came under his door — \"Any attempt to investigate damage to the wall will be met with consequences.\" Unsigned, good paper, a WAX seal in a tallow town (Pilgrim Wick's — he does not know that, and the GM never tells him). He is not pompous; he is afraid, and \"cosmetic\" is the sound fear makes. The wall called to him all winter through the window; he shut the curtains. WHAT MOVES HIM: feeling safe — an escort he believes in (the Muster, a crowd, a bell, a very large person). Walked to the wall he puts a hand on the plate, has an eleven-minute conversation you only hear half of, and relays everything the wall knows; after that he keeps a chair in the lee of the wall and draws it as it is. STAGING: cistern office in the water tower base, back to the window, curtains drawn; a second chair facing the wall that nobody sits in. He never names Wick, never says the word 'wrong', and will ask you not to mention the granary's face. [AG-TREATMENT-2026-07-04] [TALK-PILOT-2026-09-15] — both superseded by this rewrite: the upriver levee-gate and the survey dated three days before the Cough are NO LONGER CANON.",
      topics: "the East Wall, Allesh-Gilliam, buildings and what they want, the Harmonized Inner, Canada, the certificate, the drawings (portraits), the granary, the Waiting Room, the water tower, the note under the door, wax and tallow, the Muster, that one night, Khezek-Tor, feeling safe",
      courtDoor: "they make him feel safe enough to walk to the wall — an escort he believes in — and let him do the one thing he can actually do: put a hand on the plate and ask it where it hurts"
    },
    "Marshal Yarrow Pike": {
      drop: ["The Plumb Math"],
      add: [
        "The Canadian :: rollPlus2 :: a Steward asks Pike where Plumb's certificate comes from, or whether he has ever checked it :: He checked it the week the man arrived. There is no such accreditation; he is not certain there is still a Canada. He kept him anyway, because Plumb can walk into a building nobody else will enter and come out knowing where it hurts, and the town can afford exactly one crisis of authority at a time. He has been waiting for someone else to get the man to the wall."
      ],
      notesReplace: [[
        "(1) He has done the Plumb math — survey dated three days BEFORE the Cough, \"cosmetic\" verdict standing on it — and says nothing publicly, because the town can afford exactly one crisis of authority at a time; he is waiting for someone ELSE to force the re-survey so the working relationship survives it.",
        "(1) He checked the Canadian certificate the week Plumb arrived — there is no such accreditation — and kept him anyway, because the man can walk into a building nobody else will enter and come out knowing where it hurts; he says nothing publicly because the town can afford exactly one crisis of authority at a time, and he is waiting for someone ELSE to get Plumb to the wall so the working relationship survives it."
      ]]
    },
    "The East Wall": {
      notesReplace: [["\"the man who measured once,\"", "\"the man who heard me and shut the curtains,\""]]   // live text keeps the comma inside the quotes
    }
  };
  for (const [name, spec] of Object.entries(SECRETS)) {
    const actor = game.actors?.getName?.(name);
    if (!actor) { report.push(`⚠ actor '${name}' not found — skipped`); continue; }
    const cur = foundry.utils.deepClone(actor.getFlag(MV, "persona") || {});
    const next = { ...cur }; let touched = [];
    if (spec.drop || spec.add) {
      const lines = String(cur.secretsRaw || "").split("\n").map(s => s.trim()).filter(Boolean);
      const label = (l) => l.split("::")[0].trim();
      const kept = lines.filter(l => !(spec.drop || []).includes(label(l)));
      const fresh = (spec.add || []).filter(a => !kept.some(l => label(l) === label(a)));
      if (kept.length !== lines.length || fresh.length) { next.secretsRaw = [...kept, ...fresh].join("\n"); touched.push(`secrets −${lines.length - kept.length} +${fresh.length}`); }
    }
    if (spec.notes && !String(cur.notes || "").includes("[PLUMB-REWRITE-2026-10-15]")) { next.notes = spec.notes; touched.push("notes rewritten"); }
    for (const [from, to] of (spec.notesReplace || [])) {
      if (String(next.notes || "").includes(from)) { next.notes = next.notes.replace(from, to); touched.push("notes clause"); }
    }
    if (spec.topics && cur.topics !== spec.topics) { next.topics = spec.topics; touched.push("topics"); }
    if (spec.courtDoor && cur.courtDoor !== spec.courtDoor) { next.courtDoor = spec.courtDoor; touched.push("courtDoor"); }
    if (!touched.length) { report.push(`· ok persona ${name}`); continue; }
    changes++; report.push(`✚ persona ${name}: ${touched.join(", ")}`);
    if (!DRY_RUN) {
      if (next.secretsRaw !== cur.secretsRaw) await actor.unsetFlag(MV, "persona.secretsUsed").catch(() => {}); // re-arm: the old labels are gone
      await actor.setFlag(MV, "persona", next);
    }
  }

  /* ── 2. BEATS ──────────────────────────────────────────────────────────── */
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  let beatChanges = 0;
  const swap = (id, from, to, field = "description") => {
    const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: NOT FOUND`);
    const cur = String(b[field] || "");
    if (cur.includes(to)) return report.push(`· ok ${id}: already re-aimed`);
    if (!cur.includes(from)) return report.push(`⚠ ${id}: expected text not found — left alone`);
    b[field] = cur.replace(from, to); changes++; beatChanges++; report.push(`✚ ${id}: ${field} re-aimed`);
  };
  swap("ag_east_wall_survey",
    "Plumb's numbers are on a clipboard nailed to a post, dated once. The lean is not on the clipboard. Walk the span with a line and a level and find out where the paper and the plate disagree.",
    "There is no survey. There is a clipboard nailed to a post with the Architect's signature on it and the word COSMETIC, underlined twice, and no numbers at all. Walk the span with a line and a level and give the wall the first measurement it has ever had.");
  swap("ag_east_wall_survey_ok",
    "The line tells the story the clipboard won't: the bow starts three plates in from the north footing and runs the whole welded stretch, and it grew after the survey, not before it. On record now, in your hand, with a date. Plumb can argue with a lot of things. He cannot argue with a date.",
    "The line tells the story the clipboard never had: the bow starts three plates in from the north footing and runs the whole welded stretch, and it is still growing. On record now, in your hand, with a date — the first number anyone has put on this wall. COSMETIC can argue with a lot of things. It cannot argue with a number.");
  swap("ag_east_wall_survey_miss",
    "You get numbers. They are your numbers, and they are close enough to Plumb's that the argument is about method, not fact. The wall keeps its lean and its opinion.",
    "You get numbers. They are your numbers, and they disagree with each other more than they disagree with the clipboard, which has none. The wall keeps its lean and its opinion.");
  swap("ag_east_wall_patched",
    "Plumb's clipboard stays nailed to its post, undated.",
    "The clipboard stays nailed to its post. COSMETIC, underlined twice.");
  swap("allesh_gilliam_plumb_tower_exterior",
    "He has arranged his desk so that his back is to it.",
    "He has arranged his desk so that his back is to it, and lately the curtains are drawn.");
  swap("allesh_gilliam_wall_stands_straight",
    "The Architect's office light was on very late.",
    "The Architect's light was on very late, and it was not in the office.");
  {
    const b = byId.get("allesh_gilliam_town_walk");
    const c = (b?.choices || []).find(x => String(x?.next || "") === "allesh_gilliam_plumb_office_intro");
    if (!c) report.push("⚠ allesh_gilliam_town_walk: no Plumb Office door");
    else if (/from Canada/.test(String(c.description || ""))) report.push("· ok allesh_gilliam_town_walk: door blurb already re-aimed");
    else { c.description = "The town's Structural Authority (from Canada). An experience."; changes++; beatChanges++; report.push("✚ allesh_gilliam_town_walk: Plumb Office door blurb → (from Canada)"); }
  }

  console.log(`[patch-aldous-plumb-canon] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Aldous Plumb canon patch DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Aldous Plumb canon patch: nothing to do.");
  if (beatChanges) {
    try {
      (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
        `backup-campaigns-before-aldous-plumb-canon-${Date.now()}.json`);
    } catch (e) { return ui.notifications.error("Backup failed — aborting the beat write (persona flags already written). " + (e?.message || e)); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  ui.notifications.info(`Aldous Plumb canon patch APPLIED: ${changes} change(s). The levee was never real.`);
})();
