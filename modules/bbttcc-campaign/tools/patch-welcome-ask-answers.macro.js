/* patch-welcome-ask-answers.macro.js — the asks get answered
 * (2026-09-04, owner playtest catch: "ask about XYZ" choices dead-ended).
 *
 * Census (whole campaign): exactly SEVEN question-shaped choices route
 * straight back to a hub with no answer delivered — one per welcome beat.
 * The answers were half-authored already, hiding in choice-description
 * subtext the click never delivers. Each ask now routes to a real ANSWER
 * beat (NPC voice, seeded from the authored line), which returns to the hub.
 * Answer beats carry dialogueOffer:false — routing nodes, never invited.
 *
 * Idempotent; DRY_RUN default true; backs up campaigns. Run as GM.
 * Marker: [ASK-ANSWERS-2026-09-04]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = []);
  const byId = new Map(beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  const ANSWERS = [
    {
      id: "ag_tamsin_answer_building", parentId: "allesh_gilliam_tamsin_welcome",
      choiceRx: /what the building used to be/i,
      label: "Allesh-Gilliam — The Daylight Version",
      teaser: "He pours before he answers. Some stories want something warm in reach.",
      back: { label: "Back to the Round", next: "allesh_gilliam_town_walk" },
      gte: 1,
      desc: "He pours before he answers, because some stories go down better with something warm in " +
        "reach. \"A church. St Gilliam's, same as now — we kept the name because the name kept us, " +
        "and that's as even a trade as this town has ever managed.\" He nods at the windows, where " +
        "the light is doing its searching thing. \"When the world ended, people came here to ask " +
        "why. The building never answered — but it never asked anyone to leave, either. I try to " +
        "keep to its example.\" He slides the cup across. \"The rest of that story is a night " +
        "story. You've only just arrived. Have the day first.\""
    },
    {
      id: "ag_yarrow_answer_boards", parentId: "allesh_gilliam_yarrow_welcome",
      choiceRx: /what the boards are for/i,
      label: "Allesh-Gilliam — The Pulse of the Town",
      teaser: "Pike weighs you for a second — cost, benefit, coffee.",
      back: { label: "Back to the Round", next: "allesh_gilliam_town_walk" },
      gte: 1,
      desc: "Pike weighs you for a second — cost, benefit, coffee. Then he tips his head at the " +
        "boards. \"Patrol turns. Water pressure. Who's overdue from where, and by how long before " +
        "it means something.\" Each panel glows its own steady color, like vitals. \"A town this " +
        "size doesn't die of monsters, mostly. It dies of nobody noticing in time. So —\" he taps " +
        "the frame twice, like knocking on wood, \"— I notice.\" A pause that has been measured, " +
        "like everything else in the room. \"Tomorrow I'll show you how to read them. Today, just " +
        "know the town HAS a pulse. You're standing in the room where it's kept.\""
    },
    {
      id: "ag_etta_answer_skewer", parentId: "allesh_gilliam_etta_welcome",
      choiceRx: /what's on the skewer/i,
      label: "Allesh-Gilliam — A Door, Closing Gently",
      teaser: "Etta considers the question with the seriousness of a woman asked to disarm something.",
      back: { label: "Back to the Round", next: "allesh_gilliam_town_walk" },
      gte: 1,
      desc: "Etta considers the question with the seriousness of a woman being asked to disarm " +
        "something. \"On the skewer,\" she says, \"is dinner.\" The smile arrives — warm, absolute, " +
        "a door closing gently on the entire topic. \"You want to know what's IN dinner, and I'll " +
        "tell you what my gran told me: the Long Market runs on two currencies, and one of them is " +
        "not asking. The food is safe. Safe I can promise.\" She turns a skewer with real " +
        "tenderness. \"Named is extra.\" She hands you another one. \"Seconds?\""
    },
    {
      id: "lyrenn_rowan_answer_rhythm", parentId: "lyrenn_rowan_welcome",
      choiceRx: /what the rhythm is/i,
      label: "Lyrenn — Growing Is a Sound",
      teaser: "Rowan doesn't answer right away. Answering right away would interrupt it.",
      back: { label: "Back to the rows", next: "lyrenn_town_walk" },
      gte: 1,
      desc: "Rowan doesn't answer right away, because answering right away would interrupt it. " +
        "\"Listen past the wind,\" they say finally. \"Wind's just weather talking about itself. " +
        "Under that.\" You listen. Soil settling. Leaf against leaf. Something in the irrigation " +
        "rows keeping time like a slow instrument. \"Growing,\" Rowan says, \"is a sound, if " +
        "you're patient. Most people never get quiet enough to catch it — then they wonder why the " +
        "fields don't answer to them.\" They put a seed in your hand, unhurried. \"Lyrenn answers. " +
        "That's the whole trick of the place. Come be quiet in it sometime.\""
    },
    {
      id: "kt_drax_answer_chalk", parentId: "khezek_tor_drax_welcome",
      choiceRx: /about the chalk marks/i,
      label: "Khezek Tor — Chalk Is Cheap",
      teaser: "Calder finishes the seam he's on first. Everything waits for the seam he's on.",
      back: { label: "Back into the town", next: "khezek_tor_town_walk" },
      gte: 1,
      desc: "Calder finishes the seam he's on before answering — you get the sense EVERYTHING waits " +
        "for the seam he's on. \"Every mark's a question the mountain hasn't answered yet. Soft " +
        "spot. Odd echo. Air that moves when it shouldn't.\" He rolls the chalk across his " +
        "knuckles. \"Chalk's cheap. Surprises aren't. A man who writes his worries on the wall " +
        "gets to stop carrying them in his hands — and down here you want your hands free.\" He " +
        "glances toward the shaft, just for a beat: the look of a man who has heard one odd echo " +
        "too many lately. \"Work a mountain long enough, you learn it keeps its own ledger. I just " +
        "make sure ours matches.\""
    },
    {
      id: "kt_sable_answer_maps", parentId: "khezek_tor_sable_welcome",
      choiceRx: /what they're mapping/i,
      label: "Khezek Tor — A Different Question",
      teaser: "The pen doesn't stop.",
      back: { label: "Back into the town", next: "khezek_tor_town_walk" },
      gte: 1,
      desc: "\"The mine,\" says Sable, in the tone of someone answering a different question than " +
        "the one you asked. The pen doesn't stop. Contour lines. Depth marks. Annotations in a " +
        "shorthand that might be a language and might be a precaution. \"Maps say where things " +
        "are,\" they add, after exactly enough silence to make you complicit in it. \"Good maps " +
        "say where things were YESTERDAY. Around here, the difference pays my wages.\" They tilt " +
        "the board one degree in your direction — enough to be hospitality, not enough to be " +
        "information. \"When you need to know what's under Khezek-Tor, come at a polite distance. " +
        "Bring your own chair.\""
    },
    {
      id: "fixit_gully_answer_name", parentId: "fixit_gullywasher_welcome",
      choiceRx: /ask his name/i,
      label: "Furrier's Fixit Farm — We'll See If You Earn It",
      teaser: "The glass in his hands achieves a shine that borders on editorial.",
      back: { label: "Back to the yard", next: "fixit_town_walk" },
      gte: 2,
      desc: "\"Behind the bar? Gully.\" The glass in his hands achieves a shine that borders on " +
        "editorial. \"Short for the Gullywasher. Which is short for what the first batch of the " +
        "amber thing did to a man's opinion of his own limits.\" He sets the glass down exactly on " +
        "its ring mark. \"Everywhere else I've got another name, and we'll see if you earn it. " +
        "Names out here are like the good bottles — you don't open them for strangers, and you " +
        "feel a fool if you saved them too long.\" A nod at your drink. \"Drink up. You're doing " +
        "fine so far.\""
    }
  ];

  for (const A of ANSWERS) {
    const parent = byId.get(A.parentId);
    if (!parent) { report.push(`⚠ ${A.parentId}: NOT FOUND — skipped`); continue; }

    // 1. the answer beat
    if (byId.get(A.id)) {
      report.push(`· ok ${A.id}: already exists`);
    } else {
      const answer = {
        id: A.id,
        label: A.label,
        type: "dialog",
        questId: String(parent.questId || ""),
        questStep: (Number(parent.questStep) || 0) + 3,
        timeScale: "scene",
        timePoints: 0,
        speakerActorId: String(parent.speakerActorId || "") || undefined,
        dialogueOffer: false,   // routing node — reached by the ask, never invited
        description: A.desc,
        choices: [{ label: A.back.label, next: A.back.next, description: "", checkStat: "", checkDC: 0, failNext: "" }],
        inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: A.gte }] },
        playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true,
        showToPlayers: true, playerFacing: true,
        tags: String(parent.tags || "")
      };
      const idx = beats.indexOf(parent);
      beats.splice(idx + 1, 0, answer);
      byId.set(A.id, answer);
      changes++;
      report.push(`✚ ${A.id}: created (answers "${A.label}")`);
    }

    // 2. rewire the ask choice
    const ask = (parent.choices || []).find(c => A.choiceRx.test(String(c?.label || "")));
    if (!ask) { report.push(`⚠ ${A.parentId}: ask choice not found — skipped rewire`); continue; }
    if (String(ask.next) === A.id) { report.push(`· ok ${A.parentId}: ask already routes to the answer`); continue; }
    report.push(`✚ ${A.parentId}: "${ask.label}" ${JSON.stringify(ask.next)} -> ${A.id} (spoiler subtext replaced with teaser)`);
    ask.next = A.id;
    ask.description = A.teaser;
    changes++;
  }

  // ── 3. invite flavor for everyone (owner: "Tamsin's invite has kewl flavor
  //       text that the others don't have ;)") — inviteText per welcome; only
  //       fills blanks, never overwrites authored text. ───────────────────────
  const INVITES = {
    allesh_gilliam_yarrow_welcome:
      "hasn't stood up for anyone in years — but there's a second cup on the counter, and it's facing your way.",
    allesh_gilliam_etta_welcome:
      "is holding a skewer with your name on it. Best not to ask what else is on it.",
    lyrenn_elsin_welcome:
      "has set an extra place at the table. The stew doesn't wait, and neither does she.",
    lyrenn_rowan_welcome:
      "wants to introduce you to the ground. Bring your patience; leave your hurry at the fence.",
    khezek_tor_drax_welcome:
      "talks best while working — come down where the chalk marks are, and maybe hold something heavy.",
    khezek_tor_sable_welcome:
      "has marked a chair for you at a polite distance. It's the good one, out of the draft."
  };
  for (const [bid, text] of Object.entries(INVITES)) {
    const b = byId.get(bid);
    if (!b) { report.push(`⚠ ${bid}: NOT FOUND — skipped inviteText`); continue; }
    if (String(b.inviteText || "").trim()) { report.push(`· ok ${bid}: inviteText already authored`); continue; }
    b.inviteText = text;
    changes++;
    report.push(`✚ ${bid}: inviteText set`);
  }

  console.log(`[patch-welcome-ask-answers] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Ask-answers DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Ask-answers: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-ask-answers-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Ask-answers APPLIED: ${changes} change(s). Seven questions, seven answers.`);
})();
