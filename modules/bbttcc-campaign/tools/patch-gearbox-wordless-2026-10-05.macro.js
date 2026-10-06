/* patch-gearbox-wordless-2026-10-05.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * YOUNG GEARBOX SAYS ALMOST NOTHING (owner ruling 2026-10-05: "trim the lines, for comic effect. And let's have him offer
 * coffee!!"). Dave's new Allesh-Gilliam opening makes Gearbox so untalkative he "pre-emptively absorbs and vanishes entire
 * conversations"; his Fixit and Absolutely Reliable lines were chatty. This rewrites his speech as gestures and one or two
 * words, keeps every load-bearing fact in the narration (the Tetrarch fitting, the spanner, the three doorstops, Garren signs
 * slow, 30 Economy marks each), and adds "Drink the coffee." to the Arc Bay (loops back; repeatable).
 *   • 11 beats + 3 choice descriptions + 1 new choice; Young Gearbox's dialogue persona VOICE line rewritten to match.
 *   • Text only — routes, gates, receipts and effects are untouched. Old Gearbox (the Generator Hall) is a different man; unchanged.
 * GUARDED: a field is written only if the live text still equals what it replaces (else "⚠ drifted — skipped"; FORCE = true
 * to overwrite). Idempotent. One backup. In run-golden-13 after the Act 0–1 wordsmith.
 * HOW TO RUN: 1) run (DRY_RUN = true) → console (F12); 2) DRY_RUN = false, run again; 3) F5.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const FORCE = false;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0, drift = 0; const say = (m) => report.push(m);
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const N = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const setField = (obj, key, oldV, newV, where) => {
    const cur = obj[key] ?? "";
    if (N(cur) === N(newV)) return say(`· ok ${where} (already)`);
    if (N(cur) !== N(oldV) && !FORCE) { drift++; return say(`⚠ drifted — skipped ${where}`); }
    obj[key] = newV; changes++; say(`✎ ${where}`);
  };
  const DATA = [
 {
  "id": "fixit_arc_bay_conversation",
  "description": {
   "old": "Amazing machines of war and discounted air filters, and Young Gearbox in the middle of it with his boot on a tarp that has a shape under it. He is delighted to see you. He is delighted to see anyone. \"Browse,\" he says. \"Touch nothing. Ask anything.\"",
   "new": "Amazing machines of war and discounted air filters, and Young Gearbox in the middle of it with his boot on a tarp that has a shape under it. He is delighted to see you. You can tell, because he pours you a coffee.\n\nHe does not say anything. He holds the mug out until you take it. Then he gestures with his own mug: at the whole bay (browse), at the rigs (do not touch), and at himself, with a shrug (ask, if you must).\n\nIt is the longest speech anyone at the Farm has heard from him this week."
  },
  "addChoice": {
   "label": "Drink the coffee.",
   "next": "fixit_arc_bay_conversation",
   "description": "It is terrible. It is the best coffee you have had since you got here. He watches you finish it, nods once, and refills it without asking. Somewhere in Allesh-Gilliam, Pike and Calder feel a disturbance in the club.",
   "before": "Can we touch your rigs?"
  }
 },
 {
  "id": "fixit_arc_bay_conversation_1",
  "description": {
   "old": "Young Gearbox shrugs.\n\n\"You break it, you buy it. It breaks you, you buy it. Manner of payment TBD.\"\n\nAnd then goes back to fiddling with the mech.",
   "new": "Young Gearbox looks at the rig. Looks at you. Looks at the rig.\n\n\"Break it, buy it.\"\n\nHe goes back to fiddling with the mech. A moment later, without looking up, he points at the rig, then at you, and mimes counting out coins. If it breaks YOU, you also buy it. Manner of payment TBD."
  }
 },
 {
  "id": "fixit_arc_bay_conversation_2",
  "description": {
   "old": "Young Gearbox smiles and looks you in the eye.\n\n\"Bout time. Joans said you might be timid. I happen to have - a Leyline Stabilizer. I have heard tell that you are in the market. Let's ... talk. Gonna want Mara for this one.\"",
   "new": "Young Gearbox smiles, which nobody at the Farm has ever seen him do on purpose, and lifts one corner of the tarp. Underneath: a Leyline Stabilizer, the real thing, humming faintly. He lets the tarp drop and points across the yard at the office.\n\n\"Mara.\""
  }
 },
 {
  "id": "fixit_arc_bay_conversation_3",
  "description": {
   "old": "Young Gearbox grimaces and looks you in the eye.\n\n\"Your problem. Your the keeper of the social contract around here. He did something he ought not to have. Needs judging. Mara'll want to know what you decide to do.\"",
   "new": "Young Gearbox grimaces. He points at you. He points at the back room, where the crying is coming from. He points at you again, harder.\n\n\"Yours.\"\n\nThen, because that clearly was not enough for you: \"Mara'll want to know.\""
  }
 },
 {
  "id": "fixit_leyline_stabilizer",
  "description": {
   "old": "<p>The crate is on the Arc Bay floor with a tarp over it, and Young Gearbox has one boot on it like a man guarding a dog that might bolt. \"Leyline Stabilizer. Real one. Joans said you'd be along.\" He tips his head at the tarp. \"Before Mara names a price there's a formality, and the formality is: does it FIT? Garren's gate takes a Tetrarch fitting, and I've seen three of these go out to three towns and come back as doorstops because nobody checked.\"</p><p>He holds out a hand, palm up. \"Spanner.\"</p>",
   "new": "<p>The crate is on the Arc Bay floor with a tarp over it, and Young Gearbox has one boot on it like a man guarding a dog that might bolt. He taps the tarp: stabilizer. He taps the fitting stamped on its flank: TETRARCH, the same fitting Garren's gate takes. Then he holds up three fingers and mimes, with real sorrow, a door being propped open.</p><p>You will learn later that three of these went out to three towns unchecked and came back as doorstops. Right now you get the gist: before Mara names a price, it has to FIT.</p><p>He holds out a hand, palm up. \"Spanner.\"</p>"
  }
 },
 {
  "id": "fixit_no_spanner",
  "description": {
   "old": "<p>Gearbox's hand stays out for exactly as long as it takes you to understand that it is not going to close on nothing. \"Then I can't certify it, and Mara won't price what I can't certify, and you're going to ride back to Allesh-Gilliam, ask Garren for the gate's own spanner, and ride here again.\" He drops the tarp back over the crate. \"It's not personal. It's the difference between a stabilizer and a very expensive doorstop.\"</p><p>Pip, from somewhere above: \"Told you they'd forget it.\"</p>",
   "new": "<p>Gearbox's hand stays out for exactly as long as it takes you to understand that it is not going to close on nothing. Then he shakes his head, once. No spanner, no certificate; no certificate, no price. That is the whole policy, and he has delivered it without a word.</p><p>He drops the tarp back over the crate, points north toward Allesh-Gilliam, and mimes turning a spanner. Garren has the gate's own. Ride back for it, and ride here again.</p><p>Pip, from somewhere above: \"Told you they'd forget it.\"</p>"
  }
 },
 {
  "id": "fixit_mystery_bin",
  "choices": [
   {
    "oldLabel": "Reach in.",
    "next": "",
    "oldDescription": "A heavy cylinder with a fitting on one end. It is a doorstop. It is, on inspection, a leyline stabilizer with the wrong fitting, and Young Gearbox, from across the yard, says \"one of three.\"",
    "description": "A heavy cylinder with a fitting on one end. It is a doorstop. It is, on inspection, a leyline stabilizer with the wrong fitting, and Young Gearbox, from across the yard, without looking up, holds up three fingers."
   }
  ]
 },
 {
  "id": "fixit_load_the_crate",
  "description": {
   "old": "The crate is roped on the sledge and Young Gearbox is writing on a card in block capitals with a fitting drawn in the margin: TETRARCH. \"First certification since the Cough that says what it fits,\" he says, and blows on the ink. \"Tell your man Garren to sign his slowly. Signatures should weigh something.\"",
   "new": "The crate is roped on the sledge and Young Gearbox is writing on a card in block capitals with a fitting drawn in the margin: TETRARCH. It is the first certification since the Cough that says what it fits, and he is visibly, silently proud of it. He blows on the ink, hands it over, and says the longest sentence anyone at the Farm has heard from him this year: \"Tell Garren sign slow.\""
  },
  "choices": [
   {
    "oldLabel": "Ask about the three doorstops.",
    "next": "",
    "oldDescription": "\"Wrong fitting. Every one. Nobody brought a spanner.\" He taps the drawing in the margin. \"Nobody's forgetting again.\"",
    "description": "He holds up three fingers. Then he taps the fitting drawn in the margin, twice, hard. Nobody is forgetting again."
   }
  ]
 },
 {
  "id": "reliable_price",
  "description": {
   "old": "Young Gearbox wipes his hands on a rag that makes them worse. \"Mara's price,\" he says, the way other people say the weather. \"Thirty Economy marks from each of you. One each, so nobody owns more of her than anybody else.\" He considers this. \"Mara says you'll argue. She says don't. I say she runs best if you talk to her.\"",
   "new": "Young Gearbox wipes his hands on a rag that makes them worse, writes on the back of a parts tag, and holds it up: 30 ECONOMY. EACH. Under that, smaller: SO NOBODY OWNS MORE OF HER. Under that, smaller still, in Mara's hand: DON'T ARGUE.\n\nHe pours you a coffee while you read it. Then, with visible effort: \"Talk to her.\" He means the hovercraft."
  }
 },
 {
  "id": "reliable_bought",
  "description": {
   "old": "Mara counts it twice and writes it once. Gearbox takes the old lease card off the galley wall and gives it to you, because it's yours now too. Then he walks the hull with you, slapping panels like a horse dealer: here's where a workshop would go, here's where you'd hang a radio mast, here's the bit that rattles, and that one's free. \"She's yours,\" he says. \"Talk to her.\"",
   "new": "Mara counts it twice and writes it once. Gearbox takes the old lease card off the galley wall and hands it to you, because it's yours now too. Then he walks the hull with you, slapping panels like a horse dealer and saying nothing at all: a slap where a workshop would go, a slap where you'd hang a radio mast, a slap on the bit that rattles, and a long, fond pat on the one that's free.\n\n\"Yours,\" he says."
  }
 },
 {
  "id": "reliable_gearbox_signs",
  "description": {
   "old": "Young Gearbox finds a clean card, which takes a while, and writes on it in his best block capitals: LEASE TRANSFERRED. THE NEW FOLKS. CERTIFIED BY ME. He blows on the ink. \"You brought me a thing that is what it says it is,\" he says. \"First one since the Cough. That's worth a hovercraft.\" He pauses. \"Mara will say it isn't. Mara is wrong about this one.\"",
   "new": "Young Gearbox finds a clean card, which takes a while, and writes on it in his best block capitals: LEASE TRANSFERRED. THE NEW FOLKS. CERTIFIED BY ME. He blows on the ink and holds it out. You brought him a thing that is what it says it is, the first since the Cough, and by Fixit arithmetic that is worth a hovercraft.\n\nHe says one word, and it is the most feeling anyone has ever heard him fit into one word: \"Fits.\"\n\nMara will say it isn't worth a hovercraft. He has already written MARA IS WRONG ABOUT THIS ONE on the back of the card."
  }
 },
 {
  "id": "reliable_lease_last_turn",
  "choices": [
   {
    "oldLabel": "Plan to buy it.",
    "next": "",
    "oldDescription": "Mara has a price. Gearbox says it's fair. Gearbox says everything is fair.",
    "description": "Mara has a price. Gearbox nodded at it. Gearbox nods at every price."
   }
  ]
 }
];
  for (const r of DATA) {
    const b = byId.get(r.id); if (!b) { say(`✗ MISSING beat ${r.id}`); continue; }
    if (r.description) setField(b, "description", r.description.old, r.description.new, `${r.id}.description`);
    const choices = Array.isArray(b.choices) ? b.choices : (b.choices = []);
    for (const c of (r.choices || [])) {
      const ch = choices.find(x => N(x.label) === N(c.oldLabel) && (x.next || "") === c.next);
      if (!ch) { say(`✗ ${r.id}: choice "${c.oldLabel}" not found`); continue; }
      setField(ch, "description", c.oldDescription, c.description, `${r.id} choice "${c.oldLabel}" description`);
    }
    if (r.addChoice) {
      const a = r.addChoice;
      if (choices.some(x => N(x.label) === N(a.label))) say(`· ok ${r.id} choice "${a.label}" (already)`);
      else {
        const at = choices.findIndex(x => N(x.label) === N(a.before));
        const row = { label: a.label, next: a.next, description: a.description, checkStat: "", checkDC: 0, failNext: "" };
        if (at >= 0) choices.splice(at, 0, row); else choices.unshift(row);
        changes++; say(`✚ ${r.id} choice "${a.label}" → ${a.next}`);
      }
    }
  }
  // the dialogue persona (bbttcc-mal-voice) — so a live conversation with him is as wordless as the beats
  const actor = game.actors?.getName?.("Young Gearbox");
  let personaNew = null;
  if (!actor) say("✗ actor 'Young Gearbox' not found — persona not updated");
  else {
    const p = foundry.utils.deepClone(actor.getFlag("bbttcc-mal-voice", "persona") || {});
    let notes = String(p.notes || "");
    const OLDV = "VOICE: cheerful, fast, mercantile, looks you in the eye; \"You break it, you buy it. It breaks you, you buy it. Manner of payment TBD.\"", NEWV = "VOICE: nearly wordless (owner ruling 2026-10-05) — gestures, looks, one or two words at most (\"Break it, buy it.\" \"Spanner.\" \"Mara.\" \"Yours.\" \"Fits.\"); conversations vanish around him, and birds do NOT like him (well, most birds). He offers everyone coffee, silently, and holds the mug out until they take it. A human, a Neanderthal, who works for the Jackalopes; he drove the new Stewards into Allesh-Gilliam and said nothing the whole way.";
    const OLDG = "He thinks Garren's signature should weigh something and will say so.", NEWG = "He thinks Garren's signature should weigh something and says so in four words: \"Tell Garren sign slow.\"";
    if (notes.includes(NEWV)) say("· ok persona VOICE (already)");
    else if (notes.includes(OLDV)) { notes = notes.replace(OLDV, NEWV); changes++; say("✎ persona VOICE → nearly wordless, offers coffee"); }
    else { drift++; say("⚠ drifted — persona VOICE line not found as written; skipped"); }
    if (notes.includes(OLDG)) { notes = notes.replace(OLDG, NEWG); changes++; say("✎ persona: Garren line → four words"); }
    if (notes !== String(p.notes || "")) { p.notes = notes; personaNew = p; }
  }
  console.group(`[patch-gearbox-wordless-2026-10-05] ${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s), ${drift} drifted`); report.forEach(r => console.log(" •", r)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Gearbox wordless DRY RUN: ${changes} change(s), ${drift} drifted — console (F12). Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Gearbox wordless: nothing to change.");
  (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-gearbox-wordless-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  if (personaNew && actor) await actor.setFlag("bbttcc-mal-voice", "persona", personaNew);
  ui.notifications.info(`Gearbox wordless applied: ${changes} change(s). F5.`);
})();
