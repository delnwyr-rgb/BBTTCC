// Bad Eden — The Tent at the Edge of Town goes on rails (2026-09-14) — DRY_RUN
// ─────────────────────────────────────────────────────────────────────────────
// Owner note: the Sarmoung Hum's first rung (hum_quiet_tent) was gated at Act 0 with nothing routing
// into it, so the story model listed it as a ready door on day one — and its text is a MEMORY ("you
// were here a season ago") that a party on its first morning cannot have. Ruling: it fires on rails
// on the way out of Allesh-Gilliam to the Crossroads, as a conversation the stewards OVERHEAR between
// two travelers (Bit and Coll — names in prose only, no actors), whom they may question.
//
// This macro (idempotent, backs up `campaigns`):
//   1. Rewrites hum_quiet_tent as the overheard scene; gate Act 1; pacing.ambient (never a door, never
//      the anchor); dialogueOffer:false; two exits (ask them / leave them) → the Crossroads.
//   2. Adds hum_quiet_tent_ask (the two answer; the road out) → the Crossroads.
//   3. Routes the First Night's "Sleep. Tomorrow, the land." → hum_quiet_tent (it used to settle the chain;
//      the morning ride now passes the tent on the way to the fork).

(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  let campaigns = game.settings.get(NS, "campaigns");
  if (typeof campaigns === "string") { try { campaigns = JSON.parse(campaigns); } catch (_e) {} }
  campaigns = foundry.utils.deepClone(campaigns || {});
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = cid && campaigns[cid];
  if (!camp?.beats) return ui.notifications?.error("No active campaign with beats");
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  const report = []; let changed = 0;

  const TENT = "hum_quiet_tent", ASK = "hum_quiet_tent_ask", CROSS = "ag_crossroads_first_rides", NIGHT = "ag_first_night_soma_break";
  const tent = byId.get(TENT), night = byId.get(NIGHT);
  if (!tent || !night || !byId.get(CROSS)) return ui.notifications?.error("tent / first night / crossroads beat missing");

  const TENT_DESC = "Someone has put up a tent at the edge of the settlement — white canvas, guyed out square, so clean it looks subtracted from the landscape rather than added to it. Inside: cots, all made. A woman changes water in a basin nobody is using.\n\nTwo travelers are sitting on the guy-rope side of it with their boots off — Bit and Coll, by the way they say each other's names — having the conversation you'd have about a place you knew once.\n\n“This town used to be LOUD,” Bit says. “We were here — what, a season ago? There were dogs. There was an argument about a fence that everyone in earshot had opinions about.”\n\nColl looks at the fence. The fence is still there. “Nobody’s said when it stopped,” Coll says. “Nobody seems to have noticed it stopping.”\n\nThe woman in the tent changes the water again.";
  const ASK_DESC = "Bit is glad to be asked and Coll is glad Bit is answering. They came through with a salvage train last season and stayed three nights; the fence argument had a name — the Pettibone line — and two sides and, Bit thought, years left in it.\n\n“It’s a nice town,” Coll says, carefully, the way you’d say it about a patient. “Quieter.”\n\nAsked about the tent, they both look at it as if noticing it for the first time and agree that it is very clean. The woman inside answers everything you ask and volunteers nothing.\n\nOn the road out, one of them says, to nobody in particular: “They fed us, too. First time. Wouldn’t take coin.”";

  // 1. the tent
  const sentinel = "Bit and Coll";
  if (!String(tent.description || "").includes(sentinel)) {
    tent.description = TENT_DESC; changed++; report.push(`✚ ${TENT}: rewritten as the overheard scene`);
  } else report.push(`· ok (already) ${TENT} prose`);
  const wantReq = [{ flag: "storyPhase", gte: 1 }];
  if (JSON.stringify(tent.inject?.requires) !== JSON.stringify(wantReq)) { tent.inject = Object.assign({}, tent.inject || {}, { requires: wantReq, repeatable: false }); changed++; report.push(`✚ ${TENT}: gate → Act 1, not repeatable`); }
  if (!tent.pacing?.ambient) { tent.pacing = Object.assign({}, tent.pacing || {}, { ambient: true }); changed++; report.push(`✚ ${TENT}: pacing.ambient (never a door, never the anchor)`); }
  if (tent.dialogueOffer !== false) { tent.dialogueOffer = false; changed++; }
  const wantChoices = [
    { label: "Ask them about the fence", next: ASK, description: "Bit and Coll will talk. The woman in the tent will not, exactly." },
    { label: "Leave them to it — the road’s waiting", next: CROSS, description: "" }
  ];
  if (JSON.stringify((tent.choices || []).map(c => [c.label, c.next])) !== JSON.stringify(wantChoices.map(c => [c.label, c.next]))) { tent.choices = wantChoices; changed++; report.push(`✚ ${TENT}: exits → ask / Crossroads`); }
  if (!tent.story || tent.story.quest !== "sarmoung_hum") { tent.story = { quest: "sarmoung_hum" }; changed++; }

  // 2. the ask
  if (!byId.get(ASK)) {
    const ask = {
      id: ASK, label: "The Tent at the Edge of Town — Bit and Coll", type: "dialog", timeScale: "moment", timePoints: 0,
      description: ASK_DESC, questId: tent.questId || null, questStep: null, questRole: null, targetHexUuid: null,
      speakerActorId: null, dialogueOffer: false, playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true,
      inject: { requires: [{ flag: "storyPhase", gte: 1 }], repeatable: false, oncePerHex: false, cooldownTurns: 0 },
      pacing: { ambient: true }, story: { quest: "sarmoung_hum" },
      choices: [{ label: "On to the Crossroads", next: CROSS, description: "" }],
      worldEffects: {}, tags: "sarmoung_hum ambient story", politicalTags: ""
    };
    camp.beats.splice(camp.beats.indexOf(tent) + 1, 0, ask); byId.set(ASK, ask); changed++; report.push(`✚ beat ${ASK}`);
  } else report.push(`· ok (already) beat ${ASK}`);

  // 3. the rails: First Night → tent
  const sleep = (night.choices || []).find(c => /^sleep\b/i.test(String(c?.label || "")));
  if (!sleep) report.push(`⚠ ${NIGHT}: no "Sleep…" choice found`);
  else if (String(sleep.next || "") !== TENT) { sleep.next = TENT; sleep.description = "The day is spent and well spent. Soma Breaks all around — and in the morning, the road out passes the edge of town."; changed++; report.push(`✚ ${NIGHT}: "Sleep. Tomorrow, the land." → ${TENT} → the Crossroads`); }
  else report.push(`· ok (already) ${NIGHT} → ${TENT}`);

  if (!DRY_RUN && changed) {
    const raw = game.settings.get(NS, "campaigns");
    (foundry.utils.saveDataToFile || saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "application/json", `backup-campaigns-before-hum-tent-rails-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await game.settings.set(NS, "campaigns", campaigns);
  }
  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[patch-hum-tent-rails] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  await ChatMessage.create({ content: `<div style="font-size:12px"><b>patch-hum-tent-rails — ${banner}</b><br>${report.map(r => "&nbsp;" + r.replace(/</g, "&lt;")).join("<br>")}</div>`, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`Tent on rails: ${banner}`);
})();
