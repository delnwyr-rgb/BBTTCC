/*
 * patch-parley-to-stabilizer-2026-11-06.macro.js — Dave 2026-11-06: nobody parleys for the Absolutely Reliable in Turn 1 or 2.
 * The training Parley moves to bargaining for the Leyline Stabilizer: Trade = Persuade, Shared Oversight = Impress, stalemate or loss = Delay.
 * The lease Parley and the check-fail beat are removed, with a backup in bbttcc-exports. Dave's text for Signed Over and Load the Crate.
 * Ember Bad Eden. globalThis.__parleyDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__parleyDry !== false;
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  const report = { DRY_RUN, text: [], missed: [] };
  const beats = foundry.utils.deepClone(c.beats);
  const find = (x) => beats.find(b => b.id === x);
  const GONE = new Set(["reliable_lease_parley", "ans_reliable_lease_parley_impress_show_the_farm_what", "ans_reliable_lease_parley_persuade_renew_at_the_old", "reliable_parley_renewed", "reliable_parley_keys", "reliable_parley_stalemate", "reliable_parley_lost", "fixit_leyline_trade_fail"]);
  const NEG = "fixit_leyline_stabilizer_negotiation", DELAY = "fixit_leyline_stabilizer_delay";
  const TRADE_ANS = "ans_fixit_stabilizer_parley_trade", OVERSIGHT_ANS = "ans_fixit_stabilizer_parley_oversight";
  const SWEETEN = "Every exchange costs marks; marks put on the table besides are Sweeten the deal — the Farm keeps those whatever happens.";

  // The Stabilizer takes the Parley.
  const oldParley = find("reliable_lease_parley");
  const neg = find(NEG);
  const trade = neg.choices.find(x => x.label === "Trade"), over = neg.choices.find(x => x.label === "Shared Oversight");
  if (trade.next !== TRADE_ANS) {
    if (!oldParley) { report.missed.push("old Parley already gone, nothing to copy"); }
    else {
      const raidOf = (label) => foundry.utils.deepClone(oldParley.choices.find(x => x.label.startsWith(label)).worldEffects.raid);
      const ans = (newId, label, description) => {
        const b = foundry.utils.deepClone(find("ans_reliable_lease_parley_persuade_renew_at_the_old"));
        Object.assign(b, { id: newId, label, description, tags: "quest:leyline-stabilizer,teaching.parley,alpha.teaching" });
        b.choices = [{ label: "Not today.", next: "", description: "The offer keeps.", checkStat: "", checkDC: 0, failNext: "" }];
        return b;
      };
      beats.push(
        ans(TRADE_ANS, "Furrier's Fixit Farm - Leyline Stabilizer - Trade (a Parley)", "The console opens aimed; the goal is set. Your GM runs the rounds from the Arc Bay."),
        ans(OVERSIGHT_ANS, "Furrier's Fixit Farm - Leyline Stabilizer - Shared Oversight (a Parley)", "The console opens aimed on a show; the crowd is the Arc Bay."));
      const tr = raidOf("Persuade"), ov = raidOf("Impress");
      Object.assign(tr, { stake: `The Leyline Stabilizer, on a fair trade. ${SWEETEN}`, routes: { win: "fixit_leyline_stabilizer_trade_success", stalemate: DELAY, loss: DELAY } });
      Object.assign(ov, { stake: `The Leyline Stabilizer, with shared oversight of the network. ${SWEETEN}`, routes: { win: "fixit_leyline_stabilizer_shared_oversight_success", stalemate: DELAY, loss: DELAY } });
      Object.assign(trade, { next: TRADE_ANS, checkStat: "", checkDC: 0, failNext: "", worldEffects: { raid: tr } });
      Object.assign(over, { next: OVERSIGHT_ANS, checkStat: "", checkDC: 0, failNext: "", worldEffects: { raid: ov } });
      trade.description = trade.description.replace(/\s*Make a Persuasion check\. Marks can back it\.\s*$/, "");
      neg.tags = String(neg.tags || "") ? `${neg.tags},teaching.parley,alpha.teaching` : "teaching.parley,alpha.teaching";
      neg.description += "\n\nThis is a Parley. Talked out at the table, no dice: your Domain's standing against the Farm's, round by round, until one of you folds. Pick what you came to do — Persuade them to a fair Trade, or Impress the Farm enough to share Oversight. Every exchange costs marks from the pool you lean on — Diplomacy to persuade, Soft Power to impress; every Parley costs marks, story-offered or not. If more will help, put them on the table where they can see them: that is Sweeten the deal, on top of the price, and the Farm keeps those whatever happens. Win and the stabilizer is yours on those terms. Otherwise, you'll have to come back to it.";
      report.text.push("Stabilizer: Trade and Shared Oversight are Parleys");
    }
  }

  // The lease Parley goes.
  for (const b of beats) {
    if (GONE.has(b.id)) continue;
    const before = (b.choices || []).length;
    b.choices = (b.choices || []).filter(x => !GONE.has(x.next));
    if (b.choices.length !== before) report.text.push(`${b.id}: Parley choice gone`);
    const clean = (o) => { if (Array.isArray(o?.requires)) { const n = o.requires.filter(r => !GONE.has(r?.beatMark)); if (n.length !== o.requires.length) { o.requires = n; report.text.push(`${b.id}: gate cleaned`); } } };
    clean(b.inject); b.choices.forEach(clean);
  }

  // The last-turn answers had the Parley as their only way out.
  for (const x of ["ans_reliable_lease_last_turn_plan_to_earn_it", "ans_reliable_lease_last_turn_plan_to_buy_it", "ans_reliable_lease_last_turn_plan_to_renew_it"]) {
    const y = find(x);
    if (y && !(y.choices || []).length) { y.choices = [{ label: "Noted.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }]; report.text.push(`${x}: Noted`); }
  }

  // Dave's text.
  const signed = find("reliable_gearbox_signs");
  const SIGNED = "You earned the trust of The Farm. This is a Big Deal. Not even AJ ❤️ had managed that. And the trust of the people in charge of all the best gear in the River Heart has its rewards. Hovercrafts, for example.";
  if (signed.description !== SIGNED) { signed.description = SIGNED; report.text.push("Signed Over: text"); }
  const shake = signed.choices.find(x => x.label === "Shake on it.");
  if (shake && shake.description !== "She's yours.") { shake.description = "She's yours."; report.text.push("Signed Over: choice text"); }
  const crate = find("fixit_load_the_crate");
  const CRATE = "Young Gearbox finishes loading the crate, gives you a thumbs up - his equivalent of a high five and chest bump - and you now have the fix for the Allesh Gilliam Leygate officially in your possession.";
  if (crate.description !== CRATE) { crate.description = CRATE; report.text.push("Load the Crate: text"); }
  for (const x of ["fixit_leyline_stabilizer_trade_success", "fixit_leyline_stabilizer_shared_oversight_success", "fixit_leyline_stabilizer_hard_ask"]) {
    const l = find(x).choices.find(y => y.next === "fixit_load_the_crate");
    if (l && /writing the card/.test(l.description || "")) { l.description = ""; report.text.push(`${x}: no card`); }
  }

  // Nothing may still point at what's going.
  const keep = beats.filter(b => !GONE.has(b.id)), gone = beats.filter(b => GONE.has(b.id));
  const hits = (o) => [...GONE].some(g => JSON.stringify(o || "").includes(g));
  const { beats: _b, ...rest } = c;
  const dangling = [...keep.filter(hits).map(b => b.id), ...(hits(rest) ? ["campaign"] : []), ...(hits(C.quests.getAllQuests()) ? ["quests"] : [])];
  report.remove = gone.map(b => b.id); report.dangling = dangling;
  report.parleyWords = keep.filter(b => /reliable/.test(b.id) && /parley/i.test(JSON.stringify([b.description, b.label, (b.choices || []).map(x => [x.label, x.description])]))).map(b => b.id);
  report.marks = Object.keys(C.story.state(id)?.played || {}).filter(x => GONE.has(x));
  if (dangling.length || report.missed.length) { console.log("PARLEY " + JSON.stringify(report)); return ui.notifications.error("Parley patch: something still points at the removed beats. Nothing changed."); }
  if (!DRY_RUN && (report.text.length || gone.length)) {
    if (gone.length) {
      const file = new File([JSON.stringify({ campaignId: id, beats: gone }, null, 1)], "removed-lease-parley-beats-2026-11-06.json", { type: "application/json" });
      const up = await foundry.applications.apps.FilePicker.implementation.upload("data", "bbttcc-exports", file, {}, { notify: false });
      if (!up?.path) throw new Error("backup upload failed; nothing changed");
      report.backup = up.path;
    }
    await C.saveCampaign(id, { ...c, beats: keep });
    if (report.marks.length) await C.story.forget(report.marks, id);
  }
  console.log("PARLEY " + JSON.stringify(report));
  ui.notifications.info(`Parley patch: ${DRY_RUN ? "dry run" : "applied"}, ${report.text.length} change(s).`);
})();
