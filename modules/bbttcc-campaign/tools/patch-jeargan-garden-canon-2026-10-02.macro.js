/* patch-jeargan-garden-canon-2026-10-02.macro.js — Dave's Garden rulings (2026-10-02) applied to the Ninth Guest + Lost Statues arcs.
 * RUN IN-WORLD (GM) AFTER seed-ninth-guest-retrofit + seed-lost-statues-retrofit. DRY_RUN default true. Idempotent; backs up the campaigns setting.
 * Source: ~/NINTH_GUEST_JEARGAN_CANON_2026_10_02.md. Canon (owner, 2026-10-02):
 *   • The hundred hold back the Khezek Tor Yesodium mine blowing itself up at the Shattering (the Shield).
 *   • The Ninth Guest = the Missing One = JEARGAN: one of the hundred, on the mine's crew; his resolve broke and he was running to warn the
 *     crew when the Shattering hit; the blast woke him; he has left his statue form and is having doubts, which puts the Shield at risk.
 *   • The three Lost Statues ARE three of the hundred: they walked out to places of power to hold the line short-handed. 99 hold; the Garden
 *     holds 96 (three plinths carry cairns = gone to post; one is bare = Jeargan's).
 *   • Geburah made whole is the strength needed to fix what the hundred hold and RELEASE them (the release itself is NOT built here).
 *   • Premonitions: the hundred dreamed it before 2077 and found one another — countable (dates at their feet), never explained.
 * Every text edit is a SUBSTRING swap: if the old words are gone (a polish pass changed them) the swap is reported, not forced.
 * New beats: founders_garden_the_dates (premonitions), ninth_guest_the_name (receipt JEARGAN'S LINE, via the Hidden Vault's Service Manifest).
 * Also: Verna + Dunmore Kell + Sable personas, the World Dossier "The Garden — Ninety-Nine" page, surgical edits to the two live story scripts.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const MARKER = "[JEARGAN-CANON-2026-10-02]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; let campChanges = 0; const say = (m) => report.push(m);

  // ── helpers ────────────────────────────────────────────────────────────────
  // swap(text, old, new): returns [text, status] — "ok" (already new), "swap", or "gone" (neither present: left alone, reported)
  const swap = (text, oldS, newS) => { const t = String(text ?? ""); if (t.includes(newS)) return [t, "ok"]; if (t.includes(oldS)) return [t.replace(oldS, newS), "swap"]; return [t, "gone"]; };

  // ── 1. personas ───────────────────────────────────────────────────────────
  const findActor = (names) => (game.actors?.contents || []).find(a => names.includes(a.name)) || null;
  const personaSwap = async (names, swaps, append, who) => {
    const a = findActor(names); if (!a) return say(`✗ ${who} not found — persona skipped`);
    const cur = a.getFlag(MAL, "persona") || {}; const next = { ...cur }; let touched = false;
    for (const [field, oldS, newS] of swaps) { const [t, st] = swap(next[field], oldS, newS); if (st === "swap") { next[field] = t; touched = true; } else if (st === "gone") say(`⚠ ${who} ${field}: old words not found — left alone (polished?)`); }
    if (append && !String(next.notes || "").includes(MARKER)) { next.notes = [String(next.notes || "").trim(), `${MARKER} ${append}`].filter(Boolean).join("\n\n"); touched = true; }
    if (touched) { changes++; say(`✎ persona ${a.name}`); if (!DRY_RUN) await a.setFlag(MAL, "persona", next); } else say(`· ok persona ${a.name}`);
  };
  await personaSwap(["Dunmore Kell"], [
    ["secretsRaw", "He will not say what post. He will not say what they hold. He says the word 'Garden' once, as a place, not an answer.",
      "Three of the hundred: one of them walked off his post, and these three walked out to cover it, short-handed, and have been short-handed since. He will not say what they hold; he looks at the mountains when he doesn't say it. He says the word 'Garden' once, as the place they left."]
  ], null, "Dunmore Kell");
  await personaSwap(["Sable 9", "Sable Nine"], [
    ["notes", "the chart tradition says one hundred; the honest count says NINETY-NINE.",
      "the chart tradition says one hundred; the honest count says NINETY-SIX, and three of the missing four are Sable's own pickets, out at their posts, which leaves exactly one that MOVED."]
  ], null, "Sable");
  await personaSwap(["Verna Tulliver"], [], "THE NAME — once a Steward says JEARGAN to her (mark ninth_guest_the_name), the unreadable page holds still: it is that name, dated the night itself, and the room is booked to the end of the world. 'He checked in. He has never once come up the stairs.' She will say the name after that, gently, as if it might hear.", "Verna");

  // ── 2. beats ──────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["founders_garden_the_count", "founders_garden_the_terms", "ninth_guest_not_in_this_age", "statues_report_west"])
    if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — run seed-ninth-guest-retrofit and seed-lost-statues-retrofit first.`);
  const HEX = byId.get("founders_garden_the_count").hexName || "Founder's Garden";
  const Q = "quest_ninth_guest", KEY = "ninth_guest";
  const P4 = { flag: "storyPhase", gte: 4 };
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const beatText = (id, field, oldS, newS, what) => {
    const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`);
    const [t, st] = swap(b[field], oldS, newS);
    if (st === "swap") { b[field] = t; changes++; campChanges++; say(`✎ ${id}.${field}: ${what}`); }
    else if (st === "gone") say(`⚠ ${id}.${field}: old words not found — left alone (${what})`);
  };
  const choiceText = (id, label, newLabel, newDesc, what) => {
    const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`);
    const c = (b.choices || []).find(x => x.label === label || x.label === newLabel); if (!c) return say(`⚠ ${id}: choice "${label}" not found (${what})`);
    const before = JSON.stringify(c); if (newLabel) c.label = newLabel; if (newDesc != null) c.description = newDesc;
    if (JSON.stringify(c) !== before) { changes++; campChanges++; say(`✎ ${id} choice: ${what}`); }
  };
  const addChoice = (id, c, what, first = false) => {
    const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`);
    if ((b.choices || []).some(x => x.label === c.label)) return;
    b.choices = first ? [c, ...(b.choices || [])] : [...(b.choices || []), c]; changes++; campChanges++; say(`✚ ${id} choice: ${what}`);
  };
  const setDeep = (id, path, oldV, newV, what) => {
    const b = byId.get(id); if (!b) return; let o = b; const ks = path.split("."); for (const k of ks.slice(0, -1)) { o = o?.[k]; if (!o) return; }
    const k = ks[ks.length - 1]; if (o[k] === newV) return; if (o[k] !== oldV) return say(`⚠ ${id}.${path}: not the seeded value — left alone (${what})`);
    o[k] = newV; changes++; campChanges++; say(`✎ ${id}.${path}: ${what}`);
  };

  // 2a. the count: ninety-six, four empty plinths, three cairns
  beatText("founders_garden_the_count", "description",
    "says NINETY-NINE. The garden holds its occupied silence while you check. It already knew.",
    "says NINETY-SIX. Four plinths stand empty. Three have a small cairn of beach stones stacked on them, neat, the way you leave a coat on a seat for someone who is coming back. One is bare. The garden holds its occupied silence while you check. It already knew.",
    "ninety-six, three cairns, one bare plinth");
  { const b = byId.get("founders_garden_the_count"); const qe = b?.worldEffects?.questEffects?.find(e => e.action === "accept" && e.questId === Q);
    if (qe) { const [t, st] = swap(qe.text, "The count says ninety-nine. The rite held one hundred. One of the Committed is loose in the world.", "The count says ninety-six. Three cairns say where three went. The fourth plinth is bare, and one of the Committed is loose in the world.");
      if (st === "swap") { qe.text = t; changes++; campChanges++; say("✎ the count: quest-accept text"); } else if (st === "gone") say("⚠ the count: quest-accept text not the seeded one — left alone"); } }
  addChoice("founders_garden_the_count", ch("Read the scratches at their feet.", "founders_garden_the_dates"), "the dates (premonitions)");
  addChoice("founders_garden_the_count", ch("Count the cairns against the three basins.", "", {
    requires: [{ anyOf: [{ beatMark: "statues_tally_given" }, { beatMark: "spark_geburah_reconstituted" }, { beatMark: "statues_sable_bleeding" }] }],
    description: "A plains basin, a mountain pool, dark water: three of the hundred, standing at posts far inland, and you have stood in front of them. Ninety-six and three is ninety-nine. The fourth plinth has no cairn. Nobody stacked one. Nobody knew where to say he'd gone." }),
    "the cairns = the three statues (hidden)");

  // 2b. the plinth + the gap + the heading: the count's number
  beatText("founders_garden_the_plinth", "description", "the silence of the ninety-nine not talking about it.", "the silence of the ninety-six not talking about it.", "ninety-six");
  choiceText("founders_garden_the_gap", "Read the Terms of the Watch aloud, to them.", null,
    "Ninety-six faces do not move. Something in the ranks does: a second shoulder, and a third, a finger's width each. They heard. They are holding it anyway, one short. They said they would.", "ninety-six, one short");
  beatText("ninth_guest_heading", "description",
    "Who they were is not written on anything you have found, and the line on the hill that might have said so has been rubbed smooth by a thumb that did not want it read.",
    "Who he was is not written on anything in the Garden: the line on the hill that says so has been rubbed smooth by a thumb that did not want it read. Something written on the night itself might hold it still long enough.",
    "he; the name is findable elsewhere");

  // 2c. the terms: the smooth line is a name; the Service Manifest reads it
  addChoice("founders_garden_the_terms", ch("Lay the Service Manifest against the smooth line.", "ninth_guest_the_name", { requires: { beatMark: "hv_service_manifest" },
    description: "The Hidden Vault's paperwork, the Tamsins' private line, the night shift. The last page is a sign-off sheet." }), "the name (hidden; Hidden Vault's Service Manifest)");

  // 2d. the closer: he has a name now; the release is strength carried the last mile
  beatText("ninth_guest_not_in_this_age", "description",
    "Dawn. Ninety-nine faces, one plinth, footprints walking away, a line rubbed smooth, a room made up in a town three days inland with the curtains at the right angle. You know what the hundred hold and on what terms and how they can be let go, and you know which way the one who left was walking. You do not know who they were. Nothing you have found says, and the one thing that might have has been thumbed blank by somebody who wanted it that way. This question does not close quickly. It may not close in this age. The Garden's silence, as you go, is the silence of ninety-nine people who have decided that is all right.",
    "Dawn. Ninety-six faces, four plinths, three cairns, one set of footprints walking away, a line rubbed smooth, a room made up in a town three days inland with the curtains at the right angle. You know what the hundred hold and on what terms, and you know which way the one who left was walking. If you have his name, you have it from the paperwork of the night and a hill, not from the Garden; the Garden will not say it, and he thumbed it out himself. Ninety-nine are holding one short, and the three who went out to cover his post are bleeding for it. Letting them go will take strength that can be answered to, carried the last mile and set down. Not tonight. The Garden's silence, as you go, is the silence of ninety-nine people who have decided that is all right, for now.",
    "the vigil: he has a name; the release needs Geburah");
  setDeep("ninth_guest_not_in_this_age", "label", "The Founders' Garden — Not in This Age", "The Founders' Garden — The Vigil", "label → The Vigil");
  setDeep("ninth_guest_not_in_this_age", "memoryText", "The Stewards kept a night's vigil at the Founders' Garden and left the Ninth Guest unnamed: not in this age.",
    "The Stewards kept a night's vigil at the Founders' Garden: ninety-nine holding one short, and the one who left still deciding.", "memory");
  { const b = byId.get("ninth_guest_not_in_this_age"); const qe = b?.worldEffects?.questEffects?.find(e => e.action === "complete" && e.questId === Q);
    if (qe) { const [t, st] = swap(qe.text, "The count is ninety-nine, the terms are read, the heading is known, and the name is not. Not in this age.", "Ninety-six in the Garden, three at their posts, one walking. The terms are read and the heading is known. The release waits on strength that can be answered to.");
      if (st === "swap") { qe.text = t; changes++; campChanges++; say("✎ the vigil: quest-complete text"); } else if (st === "gone") say("⚠ the vigil: quest-complete text not the seeded one — left alone"); } }

  // 2e. the made room: Verna can hear the name
  addChoice("ninth_guest_the_made_room", ch("Say the name: Jeargan.", "", { requires: { beatMark: "ninth_guest_the_name" },
    description: "The page stops sliding. It is the same name, in a hand that shook, dated the night itself, and the room is booked to the end of the world. Verna reads it once, out loud, and sits down on the stairs. \"He checked in,\" she says. \"He has never once come up the stairs.\"" }), "Jeargan (hidden)");

  // 2f. the statues: three of the hundred; the report goes to ninety-six; Geburah points at the release
  beatText("statues_report_west", "description", "toward a hundred more of their kind standing very still.",
    "toward ninety-six more of their kind standing very still, and one place among them where nobody is.", "ninety-six");
  beatText("statues_report_west", "description", "it will have had your number for some time.",
    "it will have had your number for some time. And the Spark in your hands is the kind a Sexton would call answerable: enough strength to carry something heavy the last mile and set it down, which is the only way a watch like that ends.",
    "Geburah points at the release");
  for (const id of ["spark_geburah_confer_3_unanimous", "spark_geburah_confer_3_divided"]) {
    const b = byId.get(id); if (!b) { say(`✗ MISSING ${id}`); continue; }
    for (const field of ["description", "text"]) { if (!String(b[field] || "").includes("a hundred more of their kind")) continue;
      b[field] = String(b[field]).replace("a hundred more of their kind", "ninety-six more of their kind"); changes++; campChanges++; say(`✎ ${id}.${field}: ninety-six`); }
  }
  addChoice("statues_sexton", ch("Ask whose post they're covering.", "", {
    description: "\"One of the hundred stepped down. These three stepped out to hold the line short. Not my business who.\" He sweeps. \"Strong ones, these. Not strong enough to hold it forever. Nobody is. That's why there were a hundred.\"" }), "whose post (three of the hundred)");

  // 2g. new beats
  const beat = (id, label, description, { type = "narration", choices, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, repeatable = false, story = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q, tags: "ninth_guest story", politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, hexName: HEX, story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices, worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const NEW = [
    beat("founders_garden_the_dates", "The Founders' Garden — The Dates at Their Feet",
      "While you count you keep catching it: at the foot of every plinth, scratched small, a date. Not a birth. Not a death. Different hands, different tools, a nail, a key, a ring. The earliest is eleven years before the Shattering. They come closer together as they go, the way footsteps do when people start running toward each other. Beside some of them, a word.",
      { requires: [P4, { beatMark: "founders_garden_the_count" }], repeatable: true,
        memoryText: "Every plinth in the Founders' Garden has a date scratched at its foot, the earliest eleven years before the Shattering.",
        choices: [
          ch("Count them.", "", { description: "A hundred dates, the four empty plinths included. Eleven years of them, then three, then one long autumn. None of them is the night itself. Except one." }),
          ch("Read the words beside them.", "", { description: "DREAMED. DREAMED AGAIN. FOUND HER. FOUND THE OTHERS. SAID YES. Nobody wrote down what they dreamed. Nobody here needed to." }),
          ch("Read the bare plinth's date.", "", { description: "Three dates, each scratched out and written again, later each time. The last is the night itself. Beside it, one word, gouged deep enough to hurt the hand that did it: NOT." }),
          ch("Back to the count.", "")
        ] }),
    beat("ninth_guest_the_name", "The Founders' Garden — The Name Under the Thumb",
      "You hold the Service Manifest flat against the hill, and the light comes in low off the water, and the last page does something paper should not be able to do to stone. It is the night shift's sign-off for the private line, October 31, 2077: twelve names, eleven signatures. The twelfth is struck through in the foreman's hand: WALKED OFF SHIFT 9:40 PM. UP THE HAUL ROAD. SHOUTING. The smooth line on the hill is exactly as long as that name, and with the paper beside it the thumbed stone gives the letters back one at a time, as if it had only been waiting to be asked properly. JEARGAN. One of the hundred, on the crew, dreaming the same dream as the rest of them; and on the night itself his nerve broke and he ran to tell the crew to get out. He was most of the way up the road when the mountain went. Then the stone. Then, two hundred years later, the waking up. He is the one who stepped down, and he has not decided whether he meant it, and every day he spends deciding is a day ninety-nine hold one short.",
      { requires: [P4, { beatMark: "founders_garden_the_terms" }, { beatMark: "hv_service_manifest" }], priority: "high",
        memoryText: "The Stewards read the thumbed-smooth line on the Founders' Garden hill against the Tamsin mine's night-shift sign-off: JEARGAN, who ran to warn the crew.",
        receipts: [{ label: "Jeargan's Line", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the hill at the Founders' Garden, read against the Service Manifest" },
          truth: "JEARGAN: one of the hundred, on the Tamsin mine's night shift, struck from the sign-off at 9:40 PM on October 31, 2077 for running up the haul road to warn the crew. He stepped down from the Garden and has not decided to stay down. Produced to anyone holding the Watch, it is the reason they are one short; produced to him, it is proof that somebody read his name and did not rub it out." }],
        choices: [
          ch("Say it out loud, once.", "", { description: "Ninety-six faces do not move. The hand half-raised, near the centre, is raised toward the bare plinth. It always was." }),
          ch("Leave the line as he left it.", "", { description: "You do not re-cut it. That is his to do, or not do." }),
          ch("Keep the vigil till dawn.", "ninth_guest_not_in_this_age")
        ] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; campChanges++; say(`✚ beat ${nb.id}`); }
  // routing-only (review 2026-10-01 rule): the name needs the Service Manifest; never offered by a conversation or the Director
  { const b = byId.get("ninth_guest_the_name"); if (b && b.dialogueOffer !== false) { b.dialogueOffer = false; changes++; campChanges++; say("✎ ninth_guest_the_name: routing-only"); } }

  // ── 3. story scripts (surgical: only fields still holding the seeded words) ──
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const live = storyApi?.get?.(campaignId) || {};
  const pendingScripts = [];
  const writeScript = async (key, mutate) => {
    const lS = live.scripts?.[key]; const lQ = live.quests?.[key];
    if (!lS) return say(`⚠ story script ${key} not in campaign.story — skipped (run the retrofit seeder first)`);
    const S = JSON.parse(JSON.stringify(lS)); const before = JSON.stringify(S); mutate(S);
    if (JSON.stringify(S) === before) return say(`· ok story script ${key}`);
    S.after = Array.from(new Set([...(lS.after || []), ...(S.after || [])]));   // union live after (other seeders append here)
    changes++; say(`✦ story script ${key} (surgical)`);
    pendingScripts.push([key, lQ, S]);              // written AFTER the campaigns setting (same order as the seeders)
  };
  const sw = (o, k, oldS, newS, tag) => { if (!o) return; const [t, st] = swap(o[k], oldS, newS); if (st === "swap") o[k] = t; else if (st === "gone") say(`⚠ ${tag}: old words gone — left alone`); };
  await writeScript(KEY, (S) => {
    sw(S, "description", "The count comes out wrong by one.", "The count comes out wrong by four. Three of the four left something on their plinths to say where they went.", "ninth_guest description");
    const terms = (S.steps || []).find(s => s.id === "terms"); sw(terms, "line", "One line has been thumbed blank; leave it blank.", "One line has been thumbed blank. Something written on the night itself might read it.", "terms line");
    const age = (S.steps || []).find(s => s.id === "age");
    if (age && age.label === "Not in This Age") age.label = "The Vigil";
    sw(age, "line", "You will not know who. That is allowed.", "His name is not in the Garden; it is in the paperwork of the night. The rest waits on strength that can be answered to.", "age line");
    S.doors = S.doors || [];
    if (!S.doors.some(d => d.id === "dates")) S.doors.push({ id: "dates", label: "The Dates at Their Feet", line: "Every plinth has a date scratched at its foot. Count them. None of them is the night itself. Except one.", beats: ["founders_garden_the_dates"] });
    if (!S.doors.some(d => d.id === "name")) S.doors.push({ id: "name", label: "The Name Under the Thumb", line: "The smooth line on the hill is a name. The Tamsins' paperwork from the night might hold it still long enough to read.", beats: ["ninth_guest_the_name"] });
  });
  await writeScript("lost_statues", (S) => {
    sw(S, "description", "Three stone figures stand where the Founders left them:", "Three of the hundred stand at posts they walked out to when one of them walked off his:", "lost_statues description");
  });

  // ── 4. the World Dossier page ──────────────────────────────────────────────
  const journal = game.journal?.getName?.("World Dossier") || null;
  const page = journal?.pages?.contents?.find(p => p.name === "The Garden — Ninety-Nine") || null;
  if (!page) say("· World Dossier page 'The Garden — Ninety-Nine' not found — skipped (the dossier seeder writes the new text on fresh worlds)");
  else { const [t, st] = swap(page.text?.content, "The count says ninety-nine. There is a bare plinth in the second rank,", "The count says ninety-six. Four plinths are empty: three carry small cairns of beach stones, the way you mark a seat for someone coming back; the fourth, in the second rank, is bare,");
    if (st === "swap") { changes++; say("✎ dossier page: ninety-six + cairns"); if (!DRY_RUN) await page.update({ "text.content": t }); }
    else if (st === "gone") say("⚠ dossier page: old words gone — left alone"); else say("· ok dossier page"); }

  console.log(`[patch-jeargan-garden-canon] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Jeargan / Garden canon DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Jeargan / Garden canon: nothing to do.");
  if (campChanges) {
    try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-jeargan-canon-${Date.now()}.json`); }
    catch (e) { return ui.notifications.error("Backup failed — aborting without writing beats. " + (e?.message || e)); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  for (const [key, quest, script] of pendingScripts) if (storyApi?.saveQuest) await storyApi.saveQuest(campaignId, key, { quest, script });
  ui.notifications.info(`Jeargan / Garden canon APPLIED: ${changes} change(s). Ninety-nine, one short. F5.`);
})();
